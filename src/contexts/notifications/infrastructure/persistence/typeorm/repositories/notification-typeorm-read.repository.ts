import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  BaseDatabaseRepository,
  Criteria,
  PaginatedResult,
} from '@sisques-labs/nestjs-kit';
import { applyCriteriaToQueryBuilder } from '@sisques-labs/nestjs-kit/typeorm';
import { Repository } from 'typeorm';

import { INotificationReadRepository } from '@contexts/notifications/domain/repositories/read/notification-read.repository';
import { NotificationViewModel } from '@contexts/notifications/domain/view-models/notification.view-model';
import { NotificationEntity } from '@contexts/notifications/infrastructure/persistence/typeorm/entities/notification.entity';
import { NotificationTypeormMapper } from '@contexts/notifications/infrastructure/persistence/typeorm/mappers/notification-typeorm.mapper';

@Injectable()
export class NotificationTypeormReadRepository
  extends BaseDatabaseRepository
  implements INotificationReadRepository
{
  constructor(
    @InjectRepository(NotificationEntity)
    private readonly repository: Repository<NotificationEntity>,
    private readonly mapper: NotificationTypeormMapper,
  ) {
    super();
  }

  async findById(id: string): Promise<NotificationViewModel | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.mapper.toViewModel(entity) : null;
  }

  async findByCriteria(
    criteria: Criteria,
  ): Promise<PaginatedResult<NotificationViewModel>> {
    const { page, limit, skip } = await this.calculatePagination(criteria);
    const qb = applyCriteriaToQueryBuilder(
      this.repository.createQueryBuilder('notification'),
      criteria,
      { alias: 'notification' },
    );
    const [entities, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return new PaginatedResult(
      entities.map((entity) => this.mapper.toViewModel(entity)),
      total,
      page,
      limit,
    );
  }

  async save(viewModel: NotificationViewModel): Promise<void> {
    await this.repository.save(this.toEntity(viewModel));
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  private toEntity(viewModel: NotificationViewModel): NotificationEntity {
    const entity = new NotificationEntity();

    entity.id = viewModel.id;
    entity.tenantId = viewModel.tenantId;
    entity.recipientUserId = viewModel.recipientUserId;
    entity.channel = viewModel.channel;
    entity.status = viewModel.status;
    entity.title = viewModel.title;
    entity.body = viewModel.body;
    entity.sourceService = viewModel.sourceService;
    entity.dedupeKey = viewModel.dedupeKey;
    entity.failureReason = viewModel.failureReason;
    entity.sentAt = viewModel.sentAt;
    entity.readAt = viewModel.readAt;
    entity.cancelledAt = viewModel.cancelledAt;
    entity.createdAt = viewModel.createdAt;
    entity.updatedAt = viewModel.updatedAt;

    return entity;
  }
}
