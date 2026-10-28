import { RoomType } from '@modules/listings/entities/room-type';

export const AI_EMBEDDING_DIMENSIONS = 768;

export const AI_CHAT_LIMITS = {
  MESSAGE_MAX_LENGTH: 1000,
  MAX_USER_MESSAGES_PER_HOUR: 30,
  HISTORY_CONTEXT_MESSAGES: 6,
  SUGGESTED_LISTING_LIMIT: 5,
  MAX_RELAXATION_SUGGESTIONS: 2,
  CONVERSATION_TITLE_MAX_LENGTH: 100,
  QUERY_EMBEDDING_CACHE_SIZE: 500,
  ANSWER_MAX_TOKENS: 350,
  BUDGET_RELAXATION_RATIO: 1.25,
  CHEAPER_RATIO: 0.85,
  APPROXIMATE_PRICE_MIN_RATIO: 0.8,
  APPROXIMATE_PRICE_MAX_RATIO: 1.2,
  PRICE_ROUNDING_STEP: 100_000,
} as const;

export const AI_EMBEDDING_DEFAULTS = {
  CRON_EXPRESSION: '*/10 * * * *',
  TIME_ZONE: 'Asia/Ho_Chi_Minh',
  ADVISORY_LOCK_ID: 836_401,
  BATCH_SIZE: 64,
  MAX_BATCHES_PER_RUN: 10,
  DESCRIPTION_MAX_LENGTH: 1500,
} as const;

export const AI_PROVIDER_DEFAULTS = {
  BASE_URL: 'https://api.openai.com/v1',
  CHAT_MODEL: 'gpt-4o-mini',
  EMBEDDING_MODEL: 'text-embedding-3-small',
  REQUEST_TIMEOUT_MS: 4000,
  EMBEDDING_TIMEOUT_MS: 15000,
} as const;

export const AI_ERROR_CODES = {
  SERVICE_UNAVAILABLE: 'AI-503',
} as const;

export enum AiMessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
}

export enum AiResponseType {
  RESULTS = 'results',
  NO_RESULTS = 'no_results',
  GENERAL = 'general',
  SERVICE_ERROR = 'service_error',
}

export const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  [RoomType.PHONG_TRO]: 'Phòng trọ',
  [RoomType.NHA_NGUYEN_CAN]: 'Nhà nguyên căn',
  [RoomType.CHUNG_CU_MINI]: 'Chung cư mini',
  [RoomType.KY_TUC_XA]: 'Ký túc xá',
  [RoomType.STUDIO]: 'Studio',
  [RoomType.CAN_HO_DICH_VU]: 'Căn hộ dịch vụ',
};

export const ROOM_TYPE_KEYWORDS: Record<RoomType, readonly string[]> = {
  [RoomType.PHONG_TRO]: ['phong tro', 'tro don', 'nha tro'],
  [RoomType.NHA_NGUYEN_CAN]: ['nha nguyen can', 'nguyen can'],
  [RoomType.CHUNG_CU_MINI]: ['chung cu mini', 'ccmn'],
  [RoomType.KY_TUC_XA]: ['ky tuc xa', 'ktx'],
  [RoomType.STUDIO]: ['studio'],
  [RoomType.CAN_HO_DICH_VU]: ['can ho dich vu', 'chdv'],
};

export const AMENITY_KEYWORDS: Record<number, readonly string[]> = {
  1: ['dieu hoa', 'may lanh'],
  2: ['tu lanh'],
  3: ['may giat'],
  4: ['gac lung', 'co gac', 'gac'],
  5: ['noi that', 'full do'],
  6: ['wifi', 'internet'],
  7: ['cho de xe', 'de xe', 'gui xe', 'nha xe'],
  8: ['nau an', 'bep'],
  9: ['san phoi', 'phoi do'],
  10: ['ban cong'],
  11: ['camera'],
  12: ['bao ve'],
  13: ['khoa cua dien tu', 'khoa van tay', 'khoa dien tu'],
  14: ['wc rieng', 've sinh rieng', 'toilet rieng', 'khep kin'],
  15: ['cua so'],
  16: ['thang may'],
  17: ['nuoc nong', 'binh nong lanh'],
};

export const PROVINCE_ALIASES: readonly (readonly [
  string,
  readonly string[],
])[] = [
  ['da nang', ['da nang', 'dn']],
  ['ha noi', ['ha noi', 'hn']],
  ['ho chi minh', ['ho chi minh', 'hcm', 'tphcm', 'sai gon', 'sg']],
];

export const ROOM_SEEKING_KEYWORDS = [
  'phong',
  'thue',
  'can ho',
  'ktx',
  'studio',
  'nha nguyen can',
  'cho o',
  'o ghep',
  'tim tro',
  'nha tro',
] as const;

export const CHEAPER_KEYWORDS = ['re hon', 'gia thap hon', 'mem hon'] as const;

export const UNIVERSITY_ABBREVIATIONS: readonly (readonly [string, string])[] =
  [
    ['bkdn', 'bach khoa da nang'],
    ['bkhn', 'bach khoa ha noi'],
    ['dhbk', 'bach khoa'],
    ['bk', 'bach khoa'],
  ];

export const NEAR_MY_UNIVERSITY_KEYWORDS = [
  'gan truong',
  'gan truong minh',
  'gan truong em',
] as const;

export const UNIVERSITY_NAME_PREFIXES = [
  'truong dai hoc',
  'dai hoc',
  'truong',
  'hoc vien',
] as const;

export const WARD_NAME_PREFIXES = [
  'phuong',
  'xa',
  'thi tran',
  'dac khu',
] as const;
