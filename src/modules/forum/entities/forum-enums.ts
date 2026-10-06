export enum ForumCategory {
  ROOMMATE = 'roommate',
  EXPERIENCE = 'experience',
  QUESTION = 'question',
  AREA_REVIEW = 'area_review',
}

export enum ForumPostStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  HIDDEN = 'hidden',
}

export enum ForumCommentStatus {
  PUBLISHED = 'published',
  HIDDEN = 'hidden',
}

export enum RoommateGender {
  FEMALE = 'female',
  MALE = 'male',
  ANY = 'any',
}

export enum RoommateStatus {
  OPEN = 'open',
  FULL = 'full',
}

export enum ForumReportTargetType {
  POST = 'post',
  COMMENT = 'comment',
}

export enum ForumReportReason {
  SCAM = 'scam',
  FALSE_INFORMATION = 'false_information',
  CONTACT_INFORMATION = 'contact_information',
  HARASSMENT = 'harassment',
  SPAM = 'spam',
  OTHER = 'other',
}

export enum ModerationAction {
  WARN = 'warn',
  BLOCK = 'block',
}

export enum ModerationViolationType {
  KEYWORD = 'keyword',
  PHONE_NUMBER = 'phone_number',
  BANK_ACCOUNT = 'bank_account',
}
