import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import { Listing } from '@modules/listings/entities/listing';
import { AI_EMBEDDING_DIMENSIONS } from '../constants';

@Entity('listing_embeddings')
export class ListingEmbedding {
  @PrimaryColumn({ type: 'uuid', name: 'listing_id' })
  listingId!: string;

  @Column({ type: 'vector', length: AI_EMBEDDING_DIMENSIONS })
  embedding!: number[];

  @Column({ type: 'varchar', length: 64, name: 'content_hash' })
  contentHash!: string;

  @Column({ type: 'varchar', length: 100 })
  model!: string;

  @Column({ type: 'timestamptz', name: 'embedded_at' })
  embeddedAt!: Date;

  @OneToOne(() => Listing, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'listing_id' })
  listing?: Listing;
}
