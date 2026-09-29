import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  BaseDatabaseRepository,
  Criteria,
  PaginatedResult,
} from '@sisques-labs/nestjs-kit';
import { applyCriteriaToQueryBuilder } from '@sisques-labs/nestjs-kit/typeorm';
import { QueryFailedError, Repository } from 'typeorm';

import { NotificationAggregate } from '@contexts/notifications/domain/aggregates/notification.aggregate';
import { NotificationDedupeKeyAlreadyExistsException } from '@contexts/notifications/domain/exceptions/notification-dedupe-key-already-exists.exception';
import { INotificationWriteRepository } from '@contexts/notifications/domain/repositories/write/notification-write.repository';
import { NotificationEntity } from '@contexts/notifications/infrastructure/persistence/typeorm/entities/notification.entity';
import { NotificationTypeormMapper } from '@contexts/notifications/infrastructure/persistence/typeorm/mappers/notification-typeorm.mapper';

const UNIQUE_VIOLATION_CODE = '23505';

@Injectable()
export class NotificationTypeormWriteRepository
  extends BaseDatabaseRepository
  implements INotificationWriteRepository
{
  constructor(
    @InjectRepository(NotificationEntity)
    private readonly repository: Repository<NotificationEntity>,
    private readonly mapper: NotificationTypeormMapper,
  ) {
    super();
  }

  async findById(id: string): Promise<NotificationAggregate | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.mapper.toAggregate(entity) : null;
  }

  async findByDedupeKey(
    tenantId: string,
    dedupeKey: string,
  ): Promise<NotificationAggregate | null> {
    const entity = await this.repository.findOne({
      where: { tenantId, dedupeKey },
    });
    return entity ? this.mapper.toAggregate(entity) : null;
  }

  async findByCriteria(
    criteria: Criteria,
  ): Promise<PaginatedResult<NotificationAggregate>> {
    const { page, limit, skip } = await this.calculatePagination(criteria);
    const qb = applyCriteriaToQueryBuilder(
      this.repository.createQueryBuilder('notification'),
      criteria,
      { alias: 'notification' },
    );
    const [entities, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return new PaginatedResult(
      entities.map((entity) => this.mapper.toAggregate(entity)),
      total,
      page,
      limit,
    );
  }

  async save(aggregate: NotificationAggregate): Promise<NotificationAggregate> {
    const entity = this.mapper.toEntity(aggregate);

    try {
      const saved = await this.repository.save(entity);
      return this.mapper.toAggregate(saved);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new NotificationDedupeKeyAlreadyExistsException(
          aggregate.tenantId.value,
          aggregate.dedupeKey.value,
        );
      }
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  /**
   * A single atomic `UPDATE ... WHERE id = :id` — never an insert, unlike
   * `save()`'s id-based upsert. Used by delivery's terminal-state
   * persistence (design.md D1/D2) so a notification row deleted after it
   * was read (e.g. tenant/GDPR erasure, ops cleanup, or an e2e fixture
   * truncate racing a still-in-flight delivery job) can never be
   * resurrected by a stale in-memory aggregate.
   */
  async updateIfExists(aggregate: NotificationAggregate): Promise<boolean> {
    const { id, ...fields } = this.mapper.toEntity(aggregate);
    const result = await this.repository.update({ id }, fields);
    return (result.affected ?? 0) > 0;
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof QueryFailedError &&
      (error as unknown as { code?: string }).code === UNIQUE_VIOLATION_CODE
    );
  }
}
