import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { normalizeVietnameseText } from '@common/utils';
import { Amenity } from '@modules/listings/entities/amenity';
import { Listing } from '@modules/listings/entities/listing';
import { ListingStatus } from '@modules/listings/entities/listing-status';
import { RoomType } from '@modules/listings/entities/room-type';
import { Province, Ward } from '@modules/locations/entities';
import { University, UserUniversity } from '@modules/universities/entities';
import {
  AI_CHAT_LIMITS,
  AMENITY_KEYWORDS,
  CHEAPER_KEYWORDS,
  NEAR_MY_UNIVERSITY_KEYWORDS,
  PROVINCE_ALIASES,
  ROOM_SEEKING_KEYWORDS,
  ROOM_TYPE_KEYWORDS,
  ROOM_TYPE_LABELS,
  UNIVERSITY_ABBREVIATIONS,
  UNIVERSITY_NAME_PREFIXES,
  WARD_NAME_PREFIXES,
} from '../constants';
import { AiChatCriteria, AiCriteriaDisplay } from './ai-criteria.types';

interface CatalogEntry {
  code: string;
  name: string;
  normalized: string;
}

interface UniversityEntry extends CatalogEntry {
  primary: string;
  shortName: string;
  provinceCode: string | undefined;
}

interface WardEntry extends CatalogEntry {
  provinceCode: string;
}

interface AmenityEntry {
  id: number;
  name: string;
  keywords: string[];
}

interface CriteriaCatalog {
  amenities: AmenityEntry[];
  universities: UniversityEntry[];
  provinces: CatalogEntry[];
  wards: WardEntry[];
  provinceListingCounts: Map<string, number>;
}

interface ProvinceListingCountRow {
  provinceCode: string;
  total: string;
}

interface PriceMention {
  value: number;
  index: number;
  length: number;
}

export interface ExtractedCriteria {
  criteria: AiChatCriteria;
  hasNewCriteria: boolean;
  isRoomQuery: boolean;
}

const MILLION = 1_000_000;
const THOUSAND = 1_000;
const QUALIFIER_WINDOW = 18;
const MAX_PRICE_WORDS = ['duoi', 'toi da', 'khong qua', 'max', 'nho hon', '<'];
const MIN_PRICE_WORDS = ['tren', 'it nhat', 'toi thieu', 'lon hon', '>'];
const APPROXIMATE_WORDS = ['khoang', 'tam', 'xap xi'];
const RANGE_SEPARATORS = /^\s*(den|toi|-|~)\s*$/;
const CATALOG_TTL_MS = 60 * 60 * 1000;

const containsPhrase = (text: string, phrase: string): boolean =>
  phrase.length > 0 && ` ${text} `.includes(` ${phrase} `);

const stripPunctuation = (value: string): string =>
  value
    .replace(/[^a-z0-9.,<>~\-\s]/g, ' ')
    .replace(/(?<!\d)[.,]|[.,](?!\d)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const stripPrefixes = (value: string, prefixes: readonly string[]): string => {
  const prefix = prefixes.find((item) => value.startsWith(`${item} `));

  return prefix ? value.slice(prefix.length + 1).trim() : value;
};

const roundPrice = (value: number): number =>
  Math.max(
    AI_CHAT_LIMITS.PRICE_ROUNDING_STEP,
    Math.round(value / AI_CHAT_LIMITS.PRICE_ROUNDING_STEP) *
      AI_CHAT_LIMITS.PRICE_ROUNDING_STEP,
  );

export const formatCriteriaPrice = (value: number): string =>
  `${value.toLocaleString('vi-VN')}đ`;

@Injectable()
export class AiCriteriaService {
  private catalog: CriteriaCatalog | null = null;
  private catalogLoadedAt = 0;

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async extract(
    userId: string,
    message: string,
    previous: AiChatCriteria,
  ): Promise<ExtractedCriteria> {
    const catalog = await this.getCatalog();
    const text = this.expandAbbreviations(
      stripPunctuation(normalizeVietnameseText(message)),
    );
    const extracted: AiChatCriteria = {};

    this.extractPrices(text, previous, extracted);
    this.extractArea(text, extracted);
    this.extractRoomTypes(text, extracted);
    this.extractAmenities(text, catalog, extracted);

    const provinceCode = this.findProvinceCode(text, catalog);
    const university = this.findUniversity(text, catalog, provinceCode);

    if (university) {
      extracted.universityCode = university.code;
    } else if (
      NEAR_MY_UNIVERSITY_KEYWORDS.some((item) => containsPhrase(text, item))
    ) {
      const ownUniversity = await this.dataSource
        .getRepository(UserUniversity)
        .findOne({ where: { userId }, order: { position: 'ASC' } });

      if (ownUniversity)
        extracted.universityCode = ownUniversity.universityCode;
    }

    const textWithoutUniversity = university
      ? ` ${text} `.replace(` ${university.primary} `, ' ').trim()
      : text;
    const ward = this.findWard(
      textWithoutUniversity,
      catalog,
      provinceCode ?? university?.provinceCode,
    );

    if (ward) {
      extracted.wardCode = ward.code;
      extracted.provinceCode = ward.provinceCode;
    } else if (provinceCode) {
      extracted.provinceCode = provinceCode;
    }

    const hasNewCriteria = Object.keys(extracted).length > 0;
    const criteria = this.merge(previous, extracted);
    const isRoomQuery =
      hasNewCriteria ||
      ROOM_SEEKING_KEYWORDS.some((item) => containsPhrase(text, item));

    return { criteria, hasNewCriteria, isRoomQuery };
  }

  async describe(criteria: AiChatCriteria): Promise<AiCriteriaDisplay> {
    const catalog = await this.getCatalog();
    const university = criteria.universityCode
      ? (catalog.universities.find(
          (item) => item.code === criteria.universityCode,
        ) ?? null)
      : null;
    const province = criteria.provinceCode
      ? (catalog.provinces.find(
          (item) => item.code === criteria.provinceCode,
        ) ?? null)
      : null;
    const ward = criteria.wardCode
      ? (catalog.wards.find((item) => item.code === criteria.wardCode) ?? null)
      : null;
    const amenities = catalog.amenities
      .filter((item) => criteria.amenityIds?.includes(item.id))
      .map((item) => ({ id: item.id, name: item.name }));
    const roomTypes = (criteria.roomTypes ?? []).map((value) => ({
      value,
      label: ROOM_TYPE_LABELS[value],
    }));
    const labels = [
      this.describePrice(criteria),
      criteria.minArea ? `≥ ${criteria.minArea} m²` : null,
      university ? `Gần ${university.shortName}` : null,
      ward?.name ?? province?.name ?? null,
      ...roomTypes.map((item) => item.label),
      ...amenities.map((item) => item.name),
    ].filter((item): item is string => Boolean(item));

    return {
      labels,
      university: university
        ? { code: university.code, name: university.name }
        : null,
      province: province ? { code: province.code, name: province.name } : null,
      ward: ward ? { code: ward.code, name: ward.name } : null,
      amenities,
      roomTypes,
    };
  }

  private describePrice(criteria: AiChatCriteria): string | null {
    if (criteria.minPrice && criteria.maxPrice) {
      return `${formatCriteriaPrice(criteria.minPrice)} – ${formatCriteriaPrice(criteria.maxPrice)}`;
    }

    if (criteria.maxPrice) return `≤ ${formatCriteriaPrice(criteria.maxPrice)}`;

    if (criteria.minPrice) return `≥ ${formatCriteriaPrice(criteria.minPrice)}`;

    return null;
  }

  private merge(
    previous: AiChatCriteria,
    extracted: AiChatCriteria,
  ): AiChatCriteria {
    const merged: AiChatCriteria = { ...previous, ...extracted };

    if (extracted.amenityIds) {
      merged.amenityIds = [
        ...new Set([...(previous.amenityIds ?? []), ...extracted.amenityIds]),
      ];
    }

    if (
      extracted.provinceCode &&
      !extracted.wardCode &&
      previous.provinceCode !== extracted.provinceCode
    ) {
      delete merged.wardCode;
    }

    if (
      merged.minPrice !== undefined &&
      merged.maxPrice !== undefined &&
      merged.minPrice > merged.maxPrice
    ) {
      if (extracted.maxPrice !== undefined) {
        delete merged.minPrice;
      } else {
        delete merged.maxPrice;
      }
    }

    return merged;
  }

  private expandAbbreviations(text: string): string {
    return UNIVERSITY_ABBREVIATIONS.reduce(
      (result, [abbreviation, expansion]) =>
        ` ${result} `.split(` ${abbreviation} `).join(` ${expansion} `).trim(),
      text,
    );
  }

  private extractPrices(
    text: string,
    previous: AiChatCriteria,
    target: AiChatCriteria,
  ): void {
    const millionRange =
      /(\d+(?:[.,]\d+)?)\s*(?:-|den|toi|~)\s*(\d+(?:[.,]\d+)?)\s*(?:trieu|tr|cu)(?![a-z])/.exec(
        text,
      );

    if (millionRange) {
      const values = [millionRange[1], millionRange[2]].map((item) =>
        Math.round(Number(item.replace(',', '.')) * MILLION),
      );

      target.minPrice = Math.min(...values);
      target.maxPrice = Math.max(...values);

      return;
    }

    const mentions = this.findPriceMentions(text);

    if (mentions.length === 0) {
      if (
        previous.maxPrice &&
        CHEAPER_KEYWORDS.some((item) => containsPhrase(text, item))
      ) {
        target.maxPrice = roundPrice(
          previous.maxPrice * AI_CHAT_LIMITS.CHEAPER_RATIO,
        );
      }

      return;
    }

    if (mentions.length >= 2) {
      const [first, second] = mentions;
      const between = text.slice(first.index + first.length, second.index);

      if (RANGE_SEPARATORS.test(between)) {
        target.minPrice = Math.min(first.value, second.value);
        target.maxPrice = Math.max(first.value, second.value);

        return;
      }
    }

    const mention = mentions[0];
    const before = text.slice(
      Math.max(0, mention.index - QUALIFIER_WINDOW),
      mention.index,
    );
    const hasWord = (words: readonly string[]) =>
      words.some((word) => before.includes(word));

    if (hasWord(MIN_PRICE_WORDS)) {
      target.minPrice = mention.value;

      return;
    }

    if (hasWord(APPROXIMATE_WORDS) && !hasWord(MAX_PRICE_WORDS)) {
      target.minPrice = roundPrice(
        mention.value * AI_CHAT_LIMITS.APPROXIMATE_PRICE_MIN_RATIO,
      );
      target.maxPrice = roundPrice(
        mention.value * AI_CHAT_LIMITS.APPROXIMATE_PRICE_MAX_RATIO,
      );

      return;
    }

    target.maxPrice = mention.value;
  }

  private findPriceMentions(text: string): PriceMention[] {
    const mentions: PriceMention[] = [];
    const millionPattern =
      /(\d+(?:[.,]\d+)?)\s*(trieu|tr|cu)(?:\s*(\d{1,2})(?![\d.,]*\s*(?:m2|m|met|nguoi)))?(?![a-z])/g;
    const thousandPattern = /(\d+)\s*(k|nghin|ngan)(?![a-z])/g;
    const plainPattern =
      /(?<![\d.,])(\d{1,3}(?:[.,]\d{3}){2,}|\d{6,9})(?![\d.,])/g;

    for (const match of text.matchAll(millionPattern)) {
      const base = Number(match[1].replace(',', '.'));
      const tail = match[3] ? Number(`0.${match[3]}`) : 0;

      mentions.push({
        value: Math.round((base + tail) * MILLION),
        index: match.index,
        length: match[0].length,
      });
    }

    for (const match of text.matchAll(thousandPattern)) {
      mentions.push({
        value: Number(match[1]) * THOUSAND,
        index: match.index,
        length: match[0].length,
      });
    }

    for (const match of text.matchAll(plainPattern)) {
      mentions.push({
        value: Number(match[1].replace(/[.,]/g, '')),
        index: match.index,
        length: match[0].length,
      });
    }

    return mentions
      .filter(
        (item) => item.value >= 100 * THOUSAND && item.value <= 100 * MILLION,
      )
      .sort((first, second) => first.index - second.index);
  }

  private extractArea(text: string, target: AiChatCriteria): void {
    const match = /(\d+(?:[.,]\d+)?)\s*(m2|met vuong|m vuong)(?![a-z0-9])/.exec(
      text,
    );

    if (!match) return;

    const before = text.slice(
      Math.max(0, match.index - QUALIFIER_WINDOW),
      match.index,
    );

    if (MAX_PRICE_WORDS.some((word) => before.includes(word))) return;

    target.minArea = Math.round(Number(match[1].replace(',', '.')));
  }

  private extractRoomTypes(text: string, target: AiChatCriteria): void {
    const roomTypes = (Object.keys(ROOM_TYPE_KEYWORDS) as RoomType[]).filter(
      (roomType) =>
        ROOM_TYPE_KEYWORDS[roomType].some((keyword) =>
          containsPhrase(text, keyword),
        ),
    );

    if (roomTypes.length > 0) target.roomTypes = roomTypes;
  }

  private extractAmenities(
    text: string,
    catalog: CriteriaCatalog,
    target: AiChatCriteria,
  ): void {
    const amenityIds = catalog.amenities
      .filter((amenity) =>
        amenity.keywords.some((keyword) => containsPhrase(text, keyword)),
      )
      .map((amenity) => amenity.id);

    if (amenityIds.length > 0) target.amenityIds = amenityIds;
  }

  private findProvinceCode(
    text: string,
    catalog: CriteriaCatalog,
  ): string | undefined {
    const alias = PROVINCE_ALIASES.find(([, aliases]) =>
      aliases.some((item) => containsPhrase(text, item)),
    );

    if (!alias) return undefined;

    return catalog.provinces.find((province) =>
      containsPhrase(province.normalized, alias[0]),
    )?.code;
  }

  private findUniversity(
    text: string,
    catalog: CriteriaCatalog,
    provinceCode: string | undefined,
  ): UniversityEntry | null {
    const candidates = catalog.universities
      .filter((item) => containsPhrase(text, item.primary))
      .sort(
        (first, second) =>
          Number(second.provinceCode === provinceCode) -
            Number(first.provinceCode === provinceCode) ||
          second.primary.length - first.primary.length ||
          this.getListingCount(catalog, second.provinceCode) -
            this.getListingCount(catalog, first.provinceCode),
      );

    return candidates[0] ?? null;
  }

  private findWard(
    text: string,
    catalog: CriteriaCatalog,
    provinceCode: string | undefined,
  ): WardEntry | null {
    const matches = catalog.wards
      .filter(
        (ward) =>
          ward.normalized.includes(' ') &&
          containsPhrase(text, ward.normalized),
      )
      .sort(
        (first, second) =>
          Number(second.provinceCode === provinceCode) -
            Number(first.provinceCode === provinceCode) ||
          this.getListingCount(catalog, second.provinceCode) -
            this.getListingCount(catalog, first.provinceCode) ||
          second.normalized.length - first.normalized.length,
      );

    return matches[0] ?? null;
  }

  private getListingCount(
    catalog: CriteriaCatalog,
    provinceCode: string | undefined,
  ): number {
    return provinceCode
      ? (catalog.provinceListingCounts.get(provinceCode) ?? 0)
      : 0;
  }

  private async getCatalog(): Promise<CriteriaCatalog> {
    if (this.catalog && Date.now() - this.catalogLoadedAt < CATALOG_TTL_MS) {
      return this.catalog;
    }

    const [amenities, universities, provinces, wards, listingCounts] =
      await Promise.all([
        this.dataSource.getRepository(Amenity).find({
          where: { isActive: true },
          select: { id: true, name: true },
        }),
        this.dataSource
          .getRepository(University)
          .find({ select: { code: true, name: true } }),
        this.dataSource
          .getRepository(Province)
          .find({ select: { code: true, name: true } }),
        this.dataSource
          .getRepository(Ward)
          .find({ select: { code: true, name: true, provinceCode: true } }),
        this.dataSource
          .getRepository(Listing)
          .createQueryBuilder('listing')
          .select('listing.provinceCode', 'provinceCode')
          .addSelect('COUNT(*)', 'total')
          .where('listing.status = :status', { status: ListingStatus.ACTIVE })
          .groupBy('listing.provinceCode')
          .getRawMany<ProvinceListingCountRow>(),
      ]);
    const provinceEntries = provinces.map((province) => ({
      code: province.code,
      name: province.name,
      normalized: normalizeVietnameseText(province.name),
    }));
    const provinceNames = new Set(
      provinceEntries.map((item) => item.normalized),
    );

    this.catalog = {
      amenities: amenities.map((amenity) => ({
        id: amenity.id,
        name: amenity.name,
        keywords: [
          normalizeVietnameseText(amenity.name),
          ...(AMENITY_KEYWORDS[amenity.id] ?? []),
        ],
      })),
      universities: universities.flatMap((university) => {
        const normalized = stripPunctuation(
          normalizeVietnameseText(university.name),
        );
        const primary = stripPrefixes(
          normalized.split(/\s-\s|\(/)[0].trim(),
          UNIVERSITY_NAME_PREFIXES,
        );
        const shortName = stripPrefixes(
          university.name.split(/\s-\s|\(/)[0].trim(),
          ['Trường Đại học', 'Đại học', 'Trường', 'Học viện'],
        );
        const provinceCode = provinceEntries.find((province) =>
          containsPhrase(normalized, province.normalized),
        )?.code;

        return primary.length >= 5 && !provinceNames.has(primary)
          ? [
              {
                code: university.code,
                name: university.name,
                normalized,
                primary,
                shortName: `ĐH ${shortName}`,
                provinceCode,
              },
            ]
          : [];
      }),
      provinces: provinceEntries,
      wards: wards.map((ward) => ({
        code: ward.code,
        name: ward.name,
        provinceCode: ward.provinceCode,
        normalized: stripPrefixes(
          stripPunctuation(normalizeVietnameseText(ward.name)),
          WARD_NAME_PREFIXES,
        ),
      })),
      provinceListingCounts: new Map(
        listingCounts.map((row) => [row.provinceCode, Number(row.total)]),
      ),
    };
    this.catalogLoadedAt = Date.now();

    return this.catalog;
  }
}
