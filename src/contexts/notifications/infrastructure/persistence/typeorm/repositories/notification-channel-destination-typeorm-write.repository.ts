import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  BaseDatabaseRepository,
  Criteria,
  PaginatedResult,
} from '@sisques-labs/nestjs-kit';
import { applyCriteriaToQueryBuilder } from '@sisques-labs/nestjs-kit/typeorm';
import { QueryFailedError, Repository } from 'typeorm';

import { NotificationChannelDestinationAggregate } from '@contexts/notifications/domain/aggregates/notification-channel-destination.aggregate';
import { DestinationAlreadyExistsException } from '@contexts/notifications/domain/exceptions/destination-already-exists.exception';
import { INotificationChannelDestinationWriteRepository } from '@contexts/notifications/domain/repositories/write/notification-channel-destination-write.repository';
import { assertNotificationChannelDestinationCriteria } from '@contexts/notifications/infrastructure/persistence/typeorm/criteria/notification-channel-destination-criteria.guard';
import { NotificationChannelDestinationEntity } from '@contexts/notifications/infrastructure/persistence/typeorm/entities/notification-channel-destination.entity';
import { NotificationChannelDestinationTypeormMapper } from '@contexts/notifications/infrastructure/persistence/typeorm/mappers/notification-channel-destination-typeorm.mapper';

const UNIQUE_VIOLATION_CODE = '23505';

@Injectable()
export class NotificationChannelDestinationTypeormWriteRepository
  extends BaseDatabaseRepository
  implements INotificationChannelDestinationWriteRepository
{
  constructor(
    @InjectRepository(NotificationChannelDestinationEntity)
    private readonly repository: Repository<NotificationChannelDestinationEntity>,
    private readonly mapper: NotificationChannelDestinationTypeormMapper,
  ) {
    super();
  }

  async findById(
    id: string,
  ): Promise<NotificationChannelDestinationAggregate | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.mapper.toAggregate(entity) : null;
  }

  async findByCriteria(
    criteria: Criteria,
  ): Promise<PaginatedResult<NotificationChannelDestinationAggregate>> {
    assertNotificationChannelDestinationCriteria(criteria);
    const { page, limit, skip } = await this.calculatePagination(criteria);
    const qb = applyCriteriaToQueryBuilder(
      this.repository.createQueryBuilder('notificationChannelDestination'),
      criteria,
      { alias: 'notificationChannelDestination' },
    );
    const [entities, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return new PaginatedResult(
      entities.map((entity) => this.mapper.toAggregate(entity)),
      total,
      page,
      limit,
    );
  }

  async save(
    aggregate: NotificationChannelDestinationAggregate,
  ): Promise<NotificationChannelDestinationAggregate> {
    const entity = this.mapper.toEntity(aggregate);

    try {
      const saved = await this.repository.save(entity);
      return this.mapper.toAggregate(saved);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new DestinationAlreadyExistsException(
          aggregate.tenantId.value,
          aggregate.channel.value,
        );
      }
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof QueryFailedError &&
      (error as unknown as { code?: string }).code === UNIQUE_VIOLATION_CODE
    );
  }
}
