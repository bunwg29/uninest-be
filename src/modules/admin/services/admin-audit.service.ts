import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, EntityManager, Repository } from 'typeorm';
import { createPaginatedResult } from '@common/dtos';
import { escapeLikePattern } from '@common/utils';
import { User } from '@modules/users/entities';
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
    const builder = this.repository
      .createQueryBuilder('audit')
      .leftJoin(User, 'actor', 'actor.id = audit.actorId')
      .select('audit')
      .addSelect(['actor.id', 'actor.fullName', 'actor.email', 'actor.phone'])
      .orderBy('audit.createdAt', 'DESC')
      .addOrderBy('audit.id', 'DESC')
      .offset((query.page - 1) * query.limit)
      .limit(query.limit);

    if (query.actorId) {
      builder.andWhere('audit.actorId = :actorId', { actorId: query.actorId });
    }

    if (query.action) {
      builder.andWhere('audit.action = :action', { action: query.action });
    }

    if (query.from) {
      builder.andWhere('audit.createdAt >= :from', { from: query.from });
    }

    if (query.to) {
      builder.andWhere('audit.createdAt <= :to', { to: query.to });
    }

    if (query.keyword?.trim()) {
      const keyword = `%${escapeLikePattern(query.keyword.trim())}%`;

      builder.andWhere(
        new Brackets((where) => {
          where.where('audit.action ILIKE :keyword', { keyword });
          where.orWhere('audit.reason ILIKE :keyword', { keyword });
          where.orWhere('CAST(audit.entityId AS text) ILIKE :keyword', {
            keyword,
          });
          where.orWhere('actor.fullName ILIKE :keyword', { keyword });
        }),
      );
    }

    const [total, { entities, raw }] = await Promise.all([
      builder.clone().getCount(),
      builder.getRawAndEntities<{
        actor_id: string | null;
        actor_full_name: string | null;
        actor_email: string | null;
        actor_phone: string | null;
      }>(),
    ]);
    const items = entities.map((entry, index) => {
      const row = raw[index];

      return {
        ...entry,
        actor: row?.actor_id
          ? {
              id: row.actor_id,
              fullName: row.actor_full_name,
              email: row.actor_email,
              phone: row.actor_phone,
            }
          : null,
      };
    });

    return createPaginatedResult(items, total, query.page, query.limit);
  }
}
