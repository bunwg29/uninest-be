import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly dataSource: DataSource) {}

  async check() {
    let databaseStatus = 'disconnected';
    let databaseLatency = 0;

    try {
      const start = Date.now();

      await this.dataSource.query('SELECT 1;');
      databaseLatency = Date.now() - start;
      databaseStatus = 'connected';
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);

      this.logger.error(`Database healthcheck failed: ${msg}`);
    }

    return {
      status: databaseStatus === 'connected' ? 'ok' : 'degraded',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      database: {
        status: databaseStatus,
        latencyMs: databaseLatency,
      },
      memory: {
        rssBytes: process.memoryUsage().rss,
        heapUsedBytes: process.memoryUsage().heapUsed,
      },
    };
  }
}
