import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AI_EMBEDDING_DIMENSIONS, AI_PROVIDER_DEFAULTS } from '../constants';

export interface AiProviderMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class AiProviderError extends Error {}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isNumberArray = (value: unknown): value is number[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'number');

@Injectable()
export class AiProviderService {
  private readonly logger = new Logger(AiProviderService.name);

  constructor(private readonly configService: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.configService.get<string>('AI_API_KEY'));
  }

  getEmbeddingModel(): string {
    return this.configService.get<string>(
      'AI_EMBEDDING_MODEL',
      AI_PROVIDER_DEFAULTS.EMBEDDING_MODEL,
    );
  }

  async createEmbeddings(
    inputs: string[],
    timeoutMs: number = this.getRequestTimeout(),
  ): Promise<number[][]> {
    const payload = await this.post(
      '/embeddings',
      {
        model: this.getEmbeddingModel(),
        input: inputs,
        dimensions: AI_EMBEDDING_DIMENSIONS,
      },
      timeoutMs,
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
  ): Promise<string> {
    const payload = await this.post(
      '/chat/completions',
      {
        model: this.configService.get<string>(
          'AI_CHAT_MODEL',
          AI_PROVIDER_DEFAULTS.CHAT_MODEL,
        ),
        messages,
        temperature: 0.3,
        max_tokens: maxTokens,
      },
      this.getRequestTimeout(),
    );
    const choices = isRecord(payload) ? payload.choices : undefined;
    const firstChoice: unknown = Array.isArray(choices) ? choices[0] : null;
    const message = isRecord(firstChoice) ? firstChoice.message : undefined;
    const content = isRecord(message) ? message.content : undefined;

    if (typeof content !== 'string' || !content.trim()) {
      throw new AiProviderError('Chat completion returned no content');
    }

    return content.trim();
  }

  private getRequestTimeout(): number {
    return this.configService.get<number>(
      'AI_REQUEST_TIMEOUT_MS',
      AI_PROVIDER_DEFAULTS.REQUEST_TIMEOUT_MS,
    );
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
