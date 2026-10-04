import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ForumReportReason, ForumReportTargetType } from './forum-enums';

@Entity('forum_reports')
@Index(
  'uq_forum_reports_reporter_target',
  ['reporterId', 'targetType', 'targetId'],
  { unique: true },
)
@Index('idx_forum_reports_target', ['targetType', 'targetId', 'isResolved'])
export class ForumReport {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'reporter_id' })
  reporterId!: string;

  @Column({ type: 'enum', enum: ForumReportTargetType, name: 'target_type' })
  targetType!: ForumReportTargetType;

  @Column({ type: 'uuid', name: 'target_id' })
  targetId!: string;

  @Column({ type: 'enum', enum: ForumReportReason })
  reason!: ForumReportReason;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note!: string | null;

  @Column({ type: 'boolean', name: 'is_resolved', default: false })
  isResolved!: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
