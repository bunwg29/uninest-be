import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { University } from './university';

@Entity('user_universities')
@Index('idx_user_universities_university', ['universityCode'])
export class UserUniversity {
  @PrimaryColumn({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @PrimaryColumn({ type: 'varchar', length: 20, name: 'university_code' })
  universityCode!: string;

  @Column({ type: 'smallint', default: 0 })
  position!: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => University, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'university_code' })
  university!: University;

  @ManyToOne('User', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: unknown;
}
