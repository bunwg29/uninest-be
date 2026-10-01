export const CHAT_LIMITS = {
  MAX_CONTENT_LENGTH: 2000,
  MAX_IMAGES_PER_MESSAGE: 10,
  RECALL_WINDOW_MS: 24 * 60 * 60 * 1000,
  EDIT_WINDOW_MS: 24 * 60 * 60 * 1000,
  MAX_SEARCH_KEYWORD_LENGTH: 100,
  DEFAULT_MESSAGE_PAGE_SIZE: 30,
  MAX_MESSAGE_PAGE_SIZE: 100,
  IMAGE_KEY_PREFIX: 'chat/',
} as const;

export const CHAT_EVENTS = {
  MESSAGE_CREATED: 'message.created',
  MESSAGE_RECALLED: 'message.recalled',
  MESSAGE_UPDATED: 'message.updated',
  CONVERSATION_READ: 'conversation.read',
  CONVERSATION_DELETED: 'conversation.deleted',
} as const;

export const CHAT_SOCKET_EVENTS = {
  SEND_MESSAGE: 'message.send',
  MARK_READ: 'conversation.read',
  NEW_MESSAGE: 'message.new',
  MESSAGE_RECALLED: 'message.recalled',
  MESSAGE_UPDATED: 'message.updated',
  MESSAGES_READ: 'conversation.read',
  CONVERSATION_DELETED: 'conversation.deleted',
} as const;

export const CHAT_SOCKET_NAMESPACE = 'chat';
