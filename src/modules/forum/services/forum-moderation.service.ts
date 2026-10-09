import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  FORUM_CONSTANTS,
  FORUM_MODERATED_FIELDS,
  FORUM_MODERATION_ERRORS,
  ForumModeratedField,
  MODERATION_KEYWORD_RULE,
  MODERATION_PATTERN_RULES,
} from '../constants';
import {
  CreateBannedKeywordDto,
  UpdateBannedKeywordDto,
} from '../dtos/forum-moderation.dto';
import {
  ForumBannedKeyword,
  ModerationAction,
  ModerationViolationType,
} from '../entities';

export type ModeratedContent = Partial<
  Record<ForumModeratedField, string | null | undefined>
>;

export type ModerationViolation = {
  field: ForumModeratedField;
  fieldLabel: string;
  type: ModerationViolationType;
  action: ModerationAction;
  label: string;
  message: string;
  matches: string[];
};

export type ModerationResult = {
  isClean: boolean;
  isBlocked: boolean;
  hasWarnings: boolean;
  violations: ModerationViolation[];
  sanitized: ModeratedContent;
};

type KeywordRule = {
  keyword: string;
  action: ModerationAction;
  pattern: RegExp;
};

type BannedKeywordSource = {
  keyword: string;
  action: ModerationAction;
};

type FieldMatch = {
  type: ModerationViolationType;
  action: ModerationAction;
  label: string;
  message: string;
  pattern: RegExp;
  matches: string[];
};

@Injectable()
export class ForumModerationService implements OnModuleInit {
  private readonly logger = new Logger(ForumModerationService.name);
  private keywordRules: KeywordRule[] = [];
  private keywordsLoadedAt = 0;

  constructor(
    @InjectRepository(ForumBannedKeyword)
    private readonly bannedKeywordRepository: Repository<ForumBannedKeyword>,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    await this.reloadKeywords();
  }

  getReportHideThreshold(): number {
    const configuredValue = Number(
      this.configService.get<string | number>(
        FORUM_CONSTANTS.REPORT_HIDE_THRESHOLD_ENV_KEY,
      ),
    );

    return Number.isInteger(configuredValue) && configuredValue > 0
      ? configuredValue
      : FORUM_CONSTANTS.DEFAULT_REPORT_HIDE_THRESHOLD;
  }

  extractModeratedContent(source: unknown): ModeratedContent {
    if (!source || typeof source !== 'object') {
      return {};
    }

    const record = source as Record<string, unknown>;
    const roommate =
      record.roommate && typeof record.roommate === 'object'
        ? (record.roommate as Record<string, unknown>)
        : {};
    const pickString = (value: unknown) =>
      typeof value === 'string' ? value : undefined;

    return {
      title: pickString(record.title),
      content: pickString(record.content),
      'roommate.costNote': pickString(roommate.costNote),
      'roommate.lifestyle': pickString(roommate.lifestyle),
      'roommate.area':
        pickString(roommate.streetAddress) ?? pickString(roommate.area),
    };
  }

  async moderate(content: ModeratedContent): Promise<ModerationResult> {
    await this.ensureKeywordsFresh();

    const violations: ModerationViolation[] = [];
    const sanitized: ModeratedContent = {};
    const fields = Object.keys(FORUM_MODERATED_FIELDS) as ForumModeratedField[];

    for (const field of fields) {
      const rawText = content[field];

      if (typeof rawText !== 'string' || !rawText.trim()) {
        continue;
      }

      const text = rawText.normalize('NFC');
      const fieldMatches = this.findFieldMatches(text);

      sanitized[field] = this.sanitizeText(text, fieldMatches);

      for (const fieldMatch of fieldMatches) {
        violations.push({
          field,
          fieldLabel: FORUM_MODERATED_FIELDS[field],
          type: fieldMatch.type,
          action: fieldMatch.action,
          label: fieldMatch.label,
          message: fieldMatch.message,
          matches: fieldMatch.matches,
        });
      }
    }

    const isBlocked = violations.some(
      (violation) => violation.action === ModerationAction.BLOCK,
    );
    const hasWarnings = violations.some(
      (violation) => violation.action === ModerationAction.WARN,
    );

    return {
      isClean: violations.length === 0,
      isBlocked,
      hasWarnings,
      violations,
      sanitized,
    };
  }

  async assertContentAllowed(
    content: ModeratedContent,
    hasAcknowledgedWarnings: boolean,
  ): Promise<string[]> {
    const result = await this.moderate(content);
    const describe = (violation: ModerationViolation) =>
      `${violation.fieldLabel}: ${violation.label} (${violation.matches.join(', ')}) - ${violation.message}`;

    if (result.isBlocked) {
      throw new UnprocessableEntityException({
        error: FORUM_MODERATION_ERRORS.BLOCKED,
        message: result.violations
          .filter((violation) => violation.action === ModerationAction.BLOCK)
          .map(describe),
      });
    }

    if (result.hasWarnings && !hasAcknowledgedWarnings) {
      throw new UnprocessableEntityException({
        error: FORUM_MODERATION_ERRORS.NEEDS_CONFIRMATION,
        message: result.violations.map(describe),
      });
    }

    return [...new Set(result.violations.map((violation) => violation.type))];
  }

  async listKeywords() {
    return this.bannedKeywordRepository.find({
      order: { action: 'ASC', keyword: 'ASC' },
    });
  }

  async createKeyword(dto: CreateBannedKeywordDto) {
    const keyword = this.normalizeKeyword(dto.keyword);
    const existingKeyword = await this.bannedKeywordRepository.findOneBy({
      keyword,
    });

    if (existingKeyword) {
      throw new ConflictException('Từ khoá cấm đã tồn tại');
    }

    const savedKeyword = await this.bannedKeywordRepository.save(
      this.bannedKeywordRepository.create({
        keyword,
        action: dto.action ?? ModerationAction.BLOCK,
        isActive: true,
      }),
    );

    await this.reloadKeywords();

    return savedKeyword;
  }

  async updateKeyword(id: string, dto: UpdateBannedKeywordDto) {
    const bannedKeyword = await this.bannedKeywordRepository.findOneBy({ id });

    if (!bannedKeyword) {
      throw new NotFoundException('Không tìm thấy từ khoá cấm');
    }

    if (dto.keyword !== undefined) {
      const keyword = this.normalizeKeyword(dto.keyword);
      const duplicatedKeyword = await this.bannedKeywordRepository.findOneBy({
        keyword,
      });

      if (duplicatedKeyword && duplicatedKeyword.id !== id) {
        throw new ConflictException('Từ khoá cấm đã tồn tại');
      }

      bannedKeyword.keyword = keyword;
    }

    if (dto.action !== undefined) {
      bannedKeyword.action = dto.action;
    }

    if (dto.isActive !== undefined) {
      bannedKeyword.isActive = dto.isActive;
    }

    const savedKeyword = await this.bannedKeywordRepository.save(bannedKeyword);

    await this.reloadKeywords();

    return savedKeyword;
  }

  async deleteKeyword(id: string): Promise<void> {
    const result = await this.bannedKeywordRepository.delete({ id });

    if (!result.affected) {
      throw new NotFoundException('Không tìm thấy từ khoá cấm');
    }

    await this.reloadKeywords();
  }

  async reloadKeywords(): Promise<void> {
    let sources: BannedKeywordSource[];

    try {
      sources = await this.bannedKeywordRepository.find({
        where: { isActive: true },
        select: { keyword: true, action: true },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(
        `Could not load banned keywords, keeping the previous list: ${message}`,
      );

      return;
    }

    this.keywordRules = sources
      .map((source) => this.compileKeywordRule(source))
      .filter((rule): rule is KeywordRule => rule !== null);
    this.keywordsLoadedAt = Date.now();
  }

  private async ensureKeywordsFresh(): Promise<void> {
    const isExpired =
      Date.now() - this.keywordsLoadedAt > FORUM_CONSTANTS.KEYWORD_CACHE_TTL_MS;

    if (isExpired) {
      await this.reloadKeywords();
    }
  }

  private normalizeKeyword(keyword: string): string {
    return keyword.normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  private compileKeywordRule(source: BannedKeywordSource): KeywordRule | null {
    const keyword = this.normalizeKeyword(source.keyword);

    if (!keyword) {
      return null;
    }

    const escapedKeyword = keyword
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/ /g, '\\s+');

    return {
      keyword,
      action: source.action,
      pattern: new RegExp(
        `(?<![\\p{L}\\p{N}])${escapedKeyword}(?![\\p{L}\\p{N}])`,
        'giu',
      ),
    };
  }

  private findFieldMatches(text: string): FieldMatch[] {
    const fieldMatches: FieldMatch[] = [];
    const phoneRanges: [number, number][] = [];

    for (const rule of MODERATION_PATTERN_RULES) {
      const matches = [...text.matchAll(rule.pattern)]
        .filter((match) => {
          const start = match.index;
          const end = start + match[0].length;

          if (rule.type === ModerationViolationType.PHONE_NUMBER) {
            phoneRanges.push([start, end]);

            return true;
          }

          return !phoneRanges.some(
            ([phoneStart, phoneEnd]) => start < phoneEnd && end > phoneStart,
          );
        })
        .map((match) => match[0].trim());

      if (matches.length) {
        fieldMatches.push({ ...rule, matches: [...new Set(matches)] });
      }
    }

    for (const action of [ModerationAction.BLOCK, ModerationAction.WARN]) {
      const rules = this.keywordRules.filter((rule) => rule.action === action);
      const matches = rules.flatMap((rule) =>
        [...text.matchAll(rule.pattern)].map((match) => match[0]),
      );

      if (!matches.length) {
        continue;
      }

      fieldMatches.push({
        type: ModerationViolationType.KEYWORD,
        action,
        label: MODERATION_KEYWORD_RULE.label,
        message:
          action === ModerationAction.BLOCK
            ? MODERATION_KEYWORD_RULE.blockMessage
            : MODERATION_KEYWORD_RULE.warnMessage,
        pattern: new RegExp(
          rules.map((rule) => rule.pattern.source).join('|'),
          'giu',
        ),
        matches: [...new Set(matches)],
      });
    }

    return fieldMatches;
  }

  private sanitizeText(text: string, fieldMatches: FieldMatch[]): string {
    return fieldMatches
      .reduce(
        (sanitizedText, fieldMatch) =>
          sanitizedText.replace(fieldMatch.pattern, ''),
        text,
      )
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/ +([,.;:!?])/g, '$1')
      .trim();
  }
}
