import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '@modules/users/entities';
import { ForumCommentStatus } from './forum-enums';
import { ForumPost } from './forum-post';

@Entity('forum_comments')
@Index('idx_forum_comments_post_created', ['postId', 'createdAt'])
export class ForumComment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'post_id' })
  postId!: string;

  @Index('idx_forum_comments_author_id')
  @Column({ type: 'uuid', name: 'author_id' })
  authorId!: string;

  @Column({ type: 'uuid', nullable: true, name: 'parent_id' })
  parentId!: string | null;

  @Column({ type: 'text' })
  content!: string;

  @Column({
    type: 'enum',
    enum: ForumCommentStatus,
    default: ForumCommentStatus.PUBLISHED,
  })
  status!: ForumCommentStatus;

  @Column({ type: 'int', name: 'report_count', default: 0 })
  reportCount!: number;

  @Column({
    type: 'text',
    array: true,
    name: 'moderation_flags',
    default: '{}',
  })
  moderationFlags!: string[];

  @Column({ type: 'timestamptz', nullable: true, name: 'hidden_at' })
  hiddenAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at' })
  deletedAt!: Date | null;

  @ManyToOne(() => ForumPost, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'post_id' })
  post!: ForumPost;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'author_id' })
  author!: User;
}
