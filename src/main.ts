import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import {
  AllExceptionsFilter,
  HttpExceptionFilter,
  LoggingInterceptor,
  TransformInterceptor,
  createGlobalValidationPipe,
  SYSTEM_CONSTANTS,
} from '@common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);

  const port = configService.get<number>('PORT', SYSTEM_CONSTANTS.DEFAULT_PORT);

  const apiPrefix = configService.get<string>(
    'API_PREFIX',
    SYSTEM_CONSTANTS.DEFAULT_API_PREFIX,
  );

  app.setGlobalPrefix(apiPrefix);

  app.useGlobalPipes(createGlobalValidationPipe());

  app.useGlobalFilters(new AllExceptionsFilter(), new HttpExceptionFilter());

  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TransformInterceptor(),
  );

  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle(SYSTEM_CONSTANTS.APP_NAME)
    .setDescription(SYSTEM_CONSTANTS.APP_DESCRIPTION)
    .setVersion(SYSTEM_CONSTANTS.APP_VERSION)
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);

  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  await app.listen(port, '0.0.0.0');

  logger.log(`Server is running at: http://localhost:${port}/${apiPrefix}`);

  logger.log(
    `Swagger documentation is ready at: http://localhost:${port}/api/docs`,
  );
}

void bootstrap();
