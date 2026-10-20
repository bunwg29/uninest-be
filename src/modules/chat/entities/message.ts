import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '@modules/users/entities';
import { Conversation } from './conversation';
import { MessageType } from './message-type';

@Entity('messages')
@Index(
  'uq_messages_client_message',
  ['conversationId', 'senderId', 'clientMessageId'],
  { unique: true },
)
@Index('idx_messages_conversation_created', ['conversationId', 'createdAt'])
@Index('idx_messages_unread', ['conversationId'], {
  where: 'read_at IS NULL AND recalled_at IS NULL AND deleted_at IS NULL',
})
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'conversation_id' })
  conversationId!: string;

  @Column({ type: 'uuid', name: 'sender_id' })
  senderId!: string;

  @Column({ type: 'uuid', name: 'client_message_id' })
  clientMessageId!: string;

  @Column({ type: 'enum', enum: MessageType, default: MessageType.TEXT })
  type!: MessageType;

  @Column({ type: 'text', nullable: true })
  content!: string | null;

  @Column({ type: 'text', array: true, name: 'image_keys', default: '{}' })
  imageKeys!: string[];

  @Column({ type: 'timestamptz', name: 'read_at', nullable: true })
  readAt!: Date | null;

  @Column({ type: 'timestamptz', name: 'recalled_at', nullable: true })
  recalledAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at' })
  deletedAt!: Date | null;

  @ManyToOne(() => Conversation, (conversation) => conversation.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'conversation_id' })
  conversation!: Conversation;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sender_id' })
  sender!: User;
}
