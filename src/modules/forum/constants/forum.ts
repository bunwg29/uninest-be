import {
  ForumCategory,
  ForumReportReason,
  ModerationAction,
  ModerationViolationType,
  RoommateGender,
  RoommateStatus,
} from '../entities/forum-enums';

export const FORUM_CONSTANTS = {
  DEFAULT_REPORT_HIDE_THRESHOLD: 5,
  REPORT_HIDE_THRESHOLD_ENV_KEY: 'FORUM_REPORT_HIDE_THRESHOLD',
  KEYWORD_CACHE_TTL_MS: 60_000,
  MAX_IMAGES_PER_POST: 10,
  TITLE_MAX_LENGTH: 150,
  CONTENT_MAX_LENGTH: 5000,
  COMMENT_MAX_LENGTH: 1000,
  REPORT_NOTE_MAX_LENGTH: 500,
  IMAGE_KEY_PREFIX: 'forum/',
  VIDEO_KEY_PREFIX: 'forum/videos/',
} as const;

export const FORUM_CATEGORY_LABELS: Record<ForumCategory, string> = {
  [ForumCategory.ROOMMATE]: 'Tìm bạn ở ghép',
  [ForumCategory.EXPERIENCE]: 'Kinh nghiệm thuê trọ',
  [ForumCategory.QUESTION]: 'Hỏi đáp',
  [ForumCategory.AREA_REVIEW]: 'Review khu vực',
};

export const ROOMMATE_GENDER_LABELS: Record<RoommateGender, string> = {
  [RoommateGender.FEMALE]: 'Nữ',
  [RoommateGender.MALE]: 'Nam',
  [RoommateGender.ANY]: 'Không quan trọng',
};

export const ROOMMATE_STATUS_LABELS: Record<RoommateStatus, string> = {
  [RoommateStatus.OPEN]: 'Còn chỗ',
  [RoommateStatus.FULL]: 'Đã đủ',
};

export const FORUM_REPORT_REASON_LABELS: Record<ForumReportReason, string> = {
  [ForumReportReason.SCAM]: 'Lừa đảo, đòi cọc trước khi xem phòng',
  [ForumReportReason.FALSE_INFORMATION]: 'Thông tin sai sự thật',
  [ForumReportReason.CONTACT_INFORMATION]: 'Đăng số tài khoản / số điện thoại',
  [ForumReportReason.HARASSMENT]: 'Nội dung xúc phạm, quấy rối',
  [ForumReportReason.SPAM]: 'Spam, đăng trùng lặp nhiều lần',
  [ForumReportReason.OTHER]: 'Lý do khác',
};

export const FORUM_MODERATED_FIELDS = {
  title: 'Tiêu đề',
  content: 'Nội dung',
  'roommate.costNote': 'Ghi chú chi phí',
  'roommate.lifestyle': 'Tiêu chí ở ghép',
  'roommate.area': 'Khu vực',
} as const;

export type ForumModeratedField = keyof typeof FORUM_MODERATED_FIELDS;

export type ModerationPatternRule = {
  type: ModerationViolationType;
  action: ModerationAction;
  label: string;
  message: string;
  pattern: RegExp;
};

export const MODERATION_PATTERN_RULES: readonly ModerationPatternRule[] = [
  {
    type: ModerationViolationType.PHONE_NUMBER,
    action: ModerationAction.WARN,
    label: 'Số điện thoại công khai',
    message:
      'Người lạ có thể lấy số của bạn. Hãy dùng tính năng nhắn tin trong ứng dụng.',
    pattern: /(?<![\d.,])(?:\+?84|0)(?:[\s.-]?\d){9}(?![\d.,])/g,
  },
  {
    type: ModerationViolationType.BANK_ACCOUNT,
    action: ModerationAction.BLOCK,
    label: 'Số tài khoản ngân hàng',
    message:
      'Đây là dấu hiệu lừa đảo phổ biến nhất và không được phép đăng trên cộng đồng.',
    pattern:
      /(?<![\d.,])\d(?:[\s-]?\d){8,18}(?![\d.,])(?!\s*(?:đ|d|k|tr|triệu|vnđ|vnd)(?![\p{L}]))/giu,
  },
];

export const FORUM_MODERATION_ERRORS = {
  BLOCKED: 'Nội dung bị chặn do vi phạm quy định cộng đồng',
  NEEDS_CONFIRMATION: 'Nội dung có cảnh báo, cần xác nhận trước khi đăng',
} as const;

export const MODERATION_KEYWORD_RULE = {
  label: 'Từ ngữ vi phạm quy định cộng đồng',
  warnMessage:
    'Nội dung chứa từ ngữ nhạy cảm, bài có thể bị ẩn nếu bị báo cáo nhiều lần.',
  blockMessage: 'Nội dung chứa từ ngữ bị cấm và không được phép đăng.',
} as const;
