import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Environment } from '@core/config';
import { AppModule } from '../app.module';
import { PriceAggregationService } from '../modules/price-comparison';

const logger = new Logger('PriceAggregationCli');

async function run(): Promise<void> {
  const application = await NestFactory.createApplicationContext(AppModule);

  try {
    const configService = application.get(ConfigService);

    if (configService.get<Environment>('NODE_ENV') === Environment.PRODUCTION) {
      throw new Error('Manual price aggregation is disabled in production');
    }

    const service = application.get(PriceAggregationService);
    const affected = await service.aggregatePrices();

    logger.log(`Manual price aggregation completed with ${affected} groups`);
  } finally {
    await application.close();
  }
}

void run().catch((error: unknown) => {
  logger.error(
    'Manual price aggregation failed',
    error instanceof Error ? error.stack : undefined,
  );
  process.exitCode = 1;
});
