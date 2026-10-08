import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ForumPost } from './forum-post';

@Entity('forum_post_views')
@Index('idx_forum_post_views_post_viewer_created', [
  'postId',
  'viewerId',
  'createdAt',
])
export class ForumPostView {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'post_id' })
  postId!: string;

  @Column({ type: 'uuid', name: 'viewer_id' })
  viewerId!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => ForumPost, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'post_id' })
  post!: ForumPost;
}
