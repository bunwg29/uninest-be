import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ReportEntityType {
  LISTING = 'listing',
  FORUM_POST = 'forum_post',
  FORUM_COMMENT = 'forum_comment',
  USER = 'user',
}

export enum ReportStatus {
  PENDING = 'pending',
  RESOLVED = 'resolved',
  DISMISSED = 'dismissed',
}

@Entity('reports')
@Index('uq_reports_reporter_entity', ['reporterId', 'entityType', 'entityId'], {
  unique: true,
})
@Index('idx_reports_status_created', ['status', 'createdAt'])
export class Report {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'reporter_id' })
  reporterId!: string;

  @Column({ type: 'enum', enum: ReportEntityType, name: 'entity_type' })
  entityType!: ReportEntityType;

  @Column({ type: 'uuid', name: 'entity_id' })
  entityId!: string;

  @Column({ type: 'varchar', length: 80 })
  reason!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note!: string | null;

  @Column({ type: 'enum', enum: ReportStatus, default: ReportStatus.PENDING })
  status!: ReportStatus;

  @Column({ type: 'uuid', name: 'resolved_by', nullable: true })
  resolvedBy!: string | null;

  @Column({
    type: 'varchar',
    length: 500,
    name: 'resolution_reason',
    nullable: true,
  })
  resolutionReason!: string | null;

  @Column({ type: 'timestamptz', name: 'resolved_at', nullable: true })
  resolvedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
