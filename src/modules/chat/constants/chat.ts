export const CHAT_LIMITS = {
  MAX_CONTENT_LENGTH: 2000,
  MAX_IMAGES_PER_MESSAGE: 5,
  RECALL_WINDOW_MS: 24 * 60 * 60 * 1000,
  DEFAULT_MESSAGE_PAGE_SIZE: 30,
  MAX_MESSAGE_PAGE_SIZE: 100,
  IMAGE_KEY_PREFIX: 'chat/',
} as const;

export const CHAT_EVENTS = {
  MESSAGE_CREATED: 'message.created',
  MESSAGE_RECALLED: 'message.recalled',
  CONVERSATION_READ: 'conversation.read',
} as const;

export const CHAT_SOCKET_EVENTS = {
  SEND_MESSAGE: 'message.send',
  MARK_READ: 'conversation.read',
  NEW_MESSAGE: 'message.new',
  MESSAGE_RECALLED: 'message.recalled',
  MESSAGES_READ: 'conversation.read',
} as const;

export const CHAT_SOCKET_NAMESPACE = 'chat';
