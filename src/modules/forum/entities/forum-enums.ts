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

export enum RoommateSmoking {
  NO = 'no',
  OUTSIDE = 'outside',
  OK = 'ok',
}

export enum RoommateTidiness {
  VERY_TIDY = 'very_tidy',
  TIDY = 'tidy',
  RELAXED = 'relaxed',
}

export enum RoommateBedtime {
  BEFORE_23 = 'before_23',
  BEFORE_01 = 'before_01',
  FLEXIBLE = 'flexible',
}

export enum RoommatePets {
  NO = 'no',
  OK = 'ok',
}

export enum RoommateCooking {
  OFTEN = 'often',
  SOMETIMES = 'sometimes',
  NO = 'no',
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
