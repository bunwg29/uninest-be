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
import {
  ForumCategory,
  ForumPostStatus,
  RoommateBedtime,
  RoommateCooking,
  RoommateGender,
  RoommatePets,
  RoommateSmoking,
  RoommateStatus,
  RoommateTidiness,
} from './forum-enums';

export type RoommateCriteria = {
  gender: RoommateGender;
  costPerPerson: number;
  costNote: string | null;
  moveInDate: string | null;
  minStayMonths: number | null;
  lifestyle: string | null;
  smoking?: RoommateSmoking | null;
  tidiness?: RoommateTidiness | null;
  bedtime?: RoommateBedtime | null;
  pets?: RoommatePets | null;
  cooking?: RoommateCooking | null;
  area: string | null;
  provinceCode?: string | null;
  wardCode?: string | null;
  provinceName?: string | null;
  wardName?: string | null;
  streetAddress?: string | null;
};

@Entity('forum_posts')
@Index('idx_forum_posts_feed', ['status', 'category', 'publishedAt'])
export class ForumPost {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_forum_posts_author_id')
  @Column({ type: 'uuid', name: 'author_id' })
  authorId!: string;

  @Column({ type: 'enum', enum: ForumCategory })
  category!: ForumCategory;

  @Column({ type: 'varchar', length: 150 })
  title!: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'text', array: true, name: 'image_keys', default: '{}' })
  imageKeys!: string[];

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'video_key' })
  videoKey!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  roommate!: RoommateCriteria | null;

  @Column({
    type: 'enum',
    enum: RoommateStatus,
    nullable: true,
    name: 'roommate_status',
  })
  roommateStatus!: RoommateStatus | null;

  @Column({
    type: 'enum',
    enum: ForumPostStatus,
    default: ForumPostStatus.PUBLISHED,
  })
  status!: ForumPostStatus;

  @Column({ type: 'int', name: 'like_count', default: 0 })
  likeCount!: number;

  @Column({ type: 'int', name: 'comment_count', default: 0 })
  commentCount!: number;

  @Column({ type: 'int', name: 'view_count', default: 0 })
  viewCount!: number;

  @Column({ type: 'int', name: 'report_count', default: 0 })
  reportCount!: number;

  @Column({
    type: 'text',
    array: true,
    name: 'moderation_flags',
    default: '{}',
  })
  moderationFlags!: string[];

  @Column({ type: 'timestamptz', nullable: true, name: 'published_at' })
  publishedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'hidden_at' })
  hiddenAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at' })
  deletedAt!: Date | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'author_id' })
  author!: User;
}
