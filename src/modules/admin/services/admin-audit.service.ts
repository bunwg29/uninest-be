import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { createPaginatedResult } from '@common/dtos';
import { AdminAuditQueryDto } from '../dtos';
import { AuditLog } from '../entities';

@Injectable()
export class AdminAuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly repository: Repository<AuditLog>,
  ) {}

  record(
    manager: EntityManager,
    actorId: string,
    action: string,
    entityType: string,
    entityId: string,
    reason: string,
  ): Promise<AuditLog> {
    return manager.save(
      AuditLog,
      manager.create(AuditLog, {
        actorId,
        action,
        entityType,
        entityId,
        reason,
      }),
    );
  }

  async list(query: AdminAuditQueryDto) {
    const [items, total] = await this.repository.findAndCount({
      where: {
        ...(query.actorId ? { actorId: query.actorId } : {}),
        ...(query.action ? { action: query.action } : {}),
      },
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });

    return createPaginatedResult(items, total, query.page, query.limit);
  }
}
