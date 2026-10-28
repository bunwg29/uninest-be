import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '@modules/users/entities';
import type { AiChatCriteria } from '../services/ai-criteria.types';
import { AiMessage } from './ai-message';

@Entity('ai_conversations')
@Index('idx_ai_conversations_user_last_message', ['userId', 'lastMessageAt'])
export class AiConversation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'varchar', length: 100 })
  title!: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  criteria!: AiChatCriteria;

  @Column({ type: 'integer', name: 'message_count', default: 0 })
  messageCount!: number;

  @Column({ type: 'integer', name: 'suggested_listing_count', default: 0 })
  suggestedListingCount!: number;

  @Column({ type: 'timestamptz', name: 'last_message_at' })
  lastMessageAt!: Date;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at' })
  deletedAt!: Date | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @OneToMany(() => AiMessage, (message) => message.conversation)
  messages?: AiMessage[];
}
