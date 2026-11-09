import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '@modules/users/entities';
import { AiMessageRole, AiResponseType } from '../constants';
import type { AiChatCriteria } from '../services/ai-criteria.types';
import { AiConversation } from './ai-conversation';

@Entity('ai_messages')
@Index('idx_ai_messages_conversation_created', ['conversationId', 'createdAt'])
@Index('idx_ai_messages_user_created', ['userId', 'createdAt'])
export class AiMessage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'conversation_id' })
  conversationId!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'varchar', length: 20 })
  role!: AiMessageRole;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'jsonb', nullable: true })
  criteria!: AiChatCriteria | null;

  @Column({ type: 'uuid', array: true, name: 'listing_ids', default: '{}' })
  listingIds!: string[];

  @Column({
    type: 'varchar',
    length: 20,
    name: 'response_type',
    nullable: true,
  })
  responseType!: AiResponseType | null;

  @Column({ type: 'integer', name: 'matched_count', nullable: true })
  matchedCount!: number | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => AiConversation, (conversation) => conversation.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'conversation_id' })
  conversation?: AiConversation;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;
}
