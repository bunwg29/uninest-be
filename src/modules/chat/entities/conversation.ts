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
import { Listing } from '@modules/listings/entities';
import { Message } from './message';

@Entity('conversations')
@Index('uq_conversations_listing_student', ['listingId', 'studentId'], {
  unique: true,
  where: 'deleted_at IS NULL',
})
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'listing_id' })
  listingId!: string;

  @Index('idx_conversations_student_id')
  @Column({ type: 'uuid', name: 'student_id' })
  studentId!: string;

  @Index('idx_conversations_landlord_id')
  @Column({ type: 'uuid', name: 'landlord_id' })
  landlordId!: string;

  @Column({ type: 'timestamptz', name: 'last_message_at', nullable: true })
  lastMessageAt!: Date | null;

  @Column({ type: 'timestamptz', name: 'student_deleted_at', nullable: true })
  studentDeletedAt!: Date | null;

  @Column({ type: 'timestamptz', name: 'landlord_deleted_at', nullable: true })
  landlordDeletedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at' })
  deletedAt!: Date | null;

  @ManyToOne(() => Listing, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'listing_id' })
  listing!: Listing;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student!: User;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'landlord_id' })
  landlord!: User;

  @OneToMany(() => Message, (message) => message.conversation)
  messages!: Message[];
}
