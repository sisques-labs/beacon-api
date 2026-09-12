import { Injectable } from '@nestjs/common';
import { BaseTypeOrmMapper } from '@sisques-labs/nestjs-kit/typeorm';

import { NotificationAggregate } from '@contexts/notifications/domain/aggregates/notification.aggregate';
import { NotificationBuilder } from '@contexts/notifications/domain/builders/notification.builder';
import { NotificationViewModel } from '@contexts/notifications/domain/view-models/notification.view-model';
import { NotificationEntity } from '@contexts/notifications/infrastructure/persistence/typeorm/entities/notification.entity';

@Injectable()
export class NotificationTypeormMapper extends BaseTypeOrmMapper<
  NotificationAggregate,
  NotificationEntity
> {
  toAggregate(entity: NotificationEntity): NotificationAggregate {
    return this.buildFrom(entity).build();
  }

  toEntity(aggregate: NotificationAggregate): NotificationEntity {
    const primitives = aggregate.toPrimitives();
    const entity = new NotificationEntity();

    entity.id = primitives.id;
    entity.tenantId = primitives.tenantId;
    entity.recipientUserId = primitives.recipientUserId;
    entity.channel = primitives.channel;
    entity.status = primitives.status;
    entity.title = primitives.title;
    entity.body = primitives.body;
    entity.sourceService = primitives.sourceService;
    entity.dedupeKey = primitives.dedupeKey;
    entity.failureReason = primitives.failureReason;
    entity.sentAt = primitives.sentAt;
    entity.readAt = primitives.readAt;
    entity.cancelledAt = primitives.cancelledAt;
    entity.createdAt = this.normalizeDate(primitives.createdAt);
    entity.updatedAt = this.normalizeDate(primitives.updatedAt);

    return entity;
  }

  toViewModel(entity: NotificationEntity): NotificationViewModel {
    return this.buildFrom(entity).buildViewModel();
  }

  private buildFrom(entity: NotificationEntity): NotificationBuilder {
    return new NotificationBuilder()
      .withId(entity.id)
      .withTenantId(entity.tenantId)
      .withRecipientUserId(entity.recipientUserId)
      .withChannel(entity.channel)
      .withStatus(entity.status)
      .withTitle(entity.title)
      .withBody(entity.body)
      .withSourceService(entity.sourceService)
      .withDedupeKey(entity.dedupeKey)
      .withFailureReason(entity.failureReason)
      .withSentAt(entity.sentAt ? this.normalizeDate(entity.sentAt) : null)
      .withReadAt(entity.readAt ? this.normalizeDate(entity.readAt) : null)
      .withCancelledAt(
        entity.cancelledAt ? this.normalizeDate(entity.cancelledAt) : null,
      )
      .withCreatedAt(this.normalizeDate(entity.createdAt))
      .withUpdatedAt(this.normalizeDate(entity.updatedAt));
  }
}
