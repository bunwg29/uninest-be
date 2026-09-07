import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { DatabaseInitializerService } from './database-initializer.service';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isSync =
          configService.get<string | boolean>('DB_SYNCHRONIZE') === true ||
          configService.get<string | boolean>('DB_SYNCHRONIZE') === 'true';

        const isLogging =
          configService.get<string | boolean>('DB_LOGGING') === true ||
          configService.get<string | boolean>('DB_LOGGING') === 'true';

        return {
          type: 'postgres',
          host: configService.get<string>('DB_HOST', 'localhost'),
          port: configService.get<number>('DB_PORT', 5432),
          username: configService.get<string>('DB_USERNAME', 'postgres'),
          password: configService.get<string>('DB_PASSWORD'),
          database: configService.get<string>('DB_DATABASE', 'uninest_db'),
          autoLoadEntities: true,
          synchronize: isSync,
          logging: isLogging,
          namingStrategy: new SnakeNamingStrategy(),
        };
      },
    }),
  ],
  providers: [DatabaseInitializerService],
  exports: [TypeOrmModule, DatabaseInitializerService],
})
export class DatabaseModule {}
