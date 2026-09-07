import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class DatabaseInitializerService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseInitializerService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit() {
    await this.initializeExtensions();
  }

  private async initializeExtensions() {
    const extensions = ['uuid-ossp', 'postgis', 'vector'];

    for (const ext of extensions) {
      try {
        await this.dataSource.query(`CREATE EXTENSION IF NOT EXISTS "${ext}";`);
        this.logger.log(
          `PostgreSQL extension '${ext}' is active in uninest_db.`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        this.logger.warn(
          `PostgreSQL extension '${ext}' is not installed locally: ${message}. Application will use native fallbacks.`,
        );
      }
    }
  }
}
