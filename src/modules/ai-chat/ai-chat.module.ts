import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ListingsModule } from '@modules/listings/listings.module';
import { AiChatController } from './controllers';
import { AiConversation, AiMessage, ListingEmbedding } from './entities';
import {
  AiChatService,
  AiCriteriaService,
  AiProviderService,
  AiRetrievalService,
  ListingEmbeddingService,
} from './services';

@Module({
  imports: [
    TypeOrmModule.forFeature([ListingEmbedding, AiConversation, AiMessage]),
    ListingsModule,
  ],
  controllers: [AiChatController],
  providers: [
    AiProviderService,
    AiCriteriaService,
    AiRetrievalService,
    ListingEmbeddingService,
    AiChatService,
  ],
  exports: [AiProviderService, ListingEmbeddingService],
})
export class AiChatModule {}
