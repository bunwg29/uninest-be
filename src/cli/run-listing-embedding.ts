import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Environment } from '@core/config';
import { AppModule } from '../app.module';
import { ListingEmbeddingService } from '../modules/ai-chat';

const logger = new Logger('ListingEmbeddingCli');

async function run(): Promise<void> {
  const application = await NestFactory.createApplicationContext(AppModule);

  try {
    const configService = application.get(ConfigService);

    if (configService.get<Environment>('NODE_ENV') === Environment.PRODUCTION) {
      throw new Error('Manual listing embedding is disabled in production');
    }

    const service = application.get(ListingEmbeddingService);
    const embedded = await service.embedPendingListings();

    logger.log(`Manual listing embedding completed with ${embedded} listings`);
  } finally {
    await application.close();
  }
}

void run().catch((error: unknown) => {
  logger.error(
    'Manual listing embedding failed',
    error instanceof Error ? error.stack : undefined,
  );
  process.exitCode = 1;
});
