import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AI_EMBEDDING_DIMENSIONS, AI_PROVIDER_DEFAULTS } from '../constants';

export interface AiProviderMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiProviderCallOptions {
  timeoutMs?: number;
  deadline?: number;
}

interface AiProviderErrorOptions {
  status?: number;
  retryable?: boolean;
}

export class AiProviderError extends Error {
  readonly status?: number;
  readonly retryable: boolean;

  constructor(message: string, options: AiProviderErrorOptions = {}) {
    super(message);
    this.status = options.status;
    this.retryable = options.retryable ?? false;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isNumberArray = (value: unknown): value is number[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'number');

const sleep = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

@Injectable()
export class AiProviderService {
  private readonly logger = new Logger(AiProviderService.name);

  constructor(private readonly configService: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.configService.get<string>('AI_API_KEY'));
  }

  createDeadline(): number {
    return Date.now() + AI_PROVIDER_DEFAULTS.TOTAL_BUDGET_MS;
  }

  getEmbeddingModel(): string {
    return this.configService.get<string>(
      'AI_EMBEDDING_MODEL',
      AI_PROVIDER_DEFAULTS.EMBEDDING_MODEL,
    );
  }

  async createEmbeddings(
    inputs: string[],
    options: AiProviderCallOptions = {},
  ): Promise<number[][]> {
    const payload = await this.postWithRetry(
      '/embeddings',
      {
        model: this.getEmbeddingModel(),
        input: inputs,
        dimensions: AI_EMBEDDING_DIMENSIONS,
      },
      options.timeoutMs ?? AI_PROVIDER_DEFAULTS.EMBEDDING_TIMEOUT_MS,
      options.deadline ??
        Date.now() + AI_PROVIDER_DEFAULTS.EMBEDDING_TIMEOUT_MS * 2,
    );
    const data = isRecord(payload) ? payload.data : undefined;

    if (!Array.isArray(data) || data.length !== inputs.length) {
      throw new AiProviderError('Embedding response has an unexpected shape');
    }

    return data.map((item: unknown) => {
      const embedding = isRecord(item) ? item.embedding : undefined;

      if (
        !isNumberArray(embedding) ||
        embedding.length !== AI_EMBEDDING_DIMENSIONS
      ) {
        throw new AiProviderError('Embedding has an unexpected dimension');
      }

      return embedding;
    });
  }

  async createChatCompletion(
    messages: AiProviderMessage[],
    maxTokens: number,
    options: AiProviderCallOptions = {},
  ): Promise<string> {
    const models = this.getChatModels();
    const deadline = options.deadline ?? this.createDeadline();
    let lastError = new AiProviderError('No AI chat model is configured');

    for (const [index, model] of models.entries()) {
      const share = Math.floor(
        (deadline - Date.now()) / (models.length - index),
      );

      try {
        return await this.requestChatCompletion(
          model,
          messages,
          maxTokens,
          Math.min(options.timeoutMs ?? this.getRequestTimeout(), share),
          deadline,
        );
      } catch (error: unknown) {
        if (!(error instanceof AiProviderError)) throw error;

        lastError = error;

        if (index < models.length - 1) {
          this.logger.warn(
            `AI chat model ${model} failed (${error.message}), trying ${models[index + 1]}`,
          );
        }
      }
    }

    throw lastError;
  }

  private async requestChatCompletion(
    model: string,
    messages: AiProviderMessage[],
    maxTokens: number,
    timeoutMs: number,
    deadline: number,
  ): Promise<string> {
    const body = {
      model,
      messages,
      temperature: 0.3,
      max_tokens: maxTokens,
    };
    const reasoning = this.getReasoningOptions();
    let payload: unknown;

    try {
      payload = await this.postWithRetry(
        '/chat/completions',
        { ...body, ...reasoning },
        timeoutMs,
        deadline,
      );
    } catch (error: unknown) {
      if (
        !(error instanceof AiProviderError) ||
        error.status !== 400 ||
        Object.keys(reasoning).length === 0
      ) {
        throw error;
      }

      payload = await this.postWithRetry(
        '/chat/completions',
        body,
        timeoutMs,
        deadline,
      );
    }

    const choices = isRecord(payload) ? payload.choices : undefined;
    const firstChoice: unknown = Array.isArray(choices) ? choices[0] : null;
    const message = isRecord(firstChoice) ? firstChoice.message : undefined;
    const content = isRecord(message) ? message.content : undefined;

    if (typeof content !== 'string' || !content.trim()) {
      throw new AiProviderError('Chat completion returned no content');
    }

    return content.trim();
  }

  private getChatModels(): string[] {
    const primary = this.configService.get<string>(
      'AI_CHAT_MODEL',
      AI_PROVIDER_DEFAULTS.CHAT_MODEL,
    );
    const fallbacks = (
      this.configService.get<string>('AI_CHAT_FALLBACK_MODELS') ?? ''
    )
      .split(',')
      .map((model) => model.trim())
      .filter((model) => model.length > 0);

    return [...new Set([primary, ...fallbacks])];
  }

  private getReasoningOptions(): { reasoning_effort?: string } {
    const reasoningEffort = this.configService.get<string>(
      'AI_REASONING_EFFORT',
    );

    return reasoningEffort ? { reasoning_effort: reasoningEffort } : {};
  }

  private getRequestTimeout(): number {
    return this.configService.get<number>(
      'AI_REQUEST_TIMEOUT_MS',
      AI_PROVIDER_DEFAULTS.REQUEST_TIMEOUT_MS,
    );
  }

  private async postWithRetry(
    path: string,
    body: Record<string, unknown>,
    timeoutMs: number,
    deadline: number,
  ): Promise<unknown> {
    const attempts = 1 + AI_PROVIDER_DEFAULTS.MAX_RETRIES;
    let lastError = new AiProviderError('AI provider request was not sent');

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const remaining = deadline - Date.now();

      if (remaining < AI_PROVIDER_DEFAULTS.MIN_ATTEMPT_MS) break;

      try {
        return await this.post(path, body, Math.min(timeoutMs, remaining));
      } catch (error: unknown) {
        if (!(error instanceof AiProviderError)) throw error;

        lastError = error;

        if (!error.retryable) throw error;

        await sleep(AI_PROVIDER_DEFAULTS.RETRY_DELAY_MS);
      }
    }

    throw lastError;
  }

  private async post(
    path: string,
    body: Record<string, unknown>,
    timeoutMs: number,
  ): Promise<unknown> {
    const apiKey = this.configService.get<string>('AI_API_KEY');

    if (!apiKey) {
      throw new AiProviderError('AI_API_KEY is not configured');
    }

    const baseUrl = this.configService
      .get<string>('AI_BASE_URL', AI_PROVIDER_DEFAULTS.BASE_URL)
      .replace(/\/+$/, '');
    const startedAt = Date.now();

    try {
      const response = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        throw new AiProviderError(
          `AI provider responded with status ${response.status}`,
          {
            status: response.status,
            retryable: AI_PROVIDER_DEFAULTS.RETRYABLE_STATUSES.includes(
              response.status,
            ),
          },
        );
      }

      return (await response.json()) as unknown;
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : String(error);

      this.logger.warn(
        `AI provider request ${path} failed after ${Date.now() - startedAt}ms: ${reason}`,
      );

      throw error instanceof AiProviderError
        ? error
        : new AiProviderError(reason);
    }
  }
}
