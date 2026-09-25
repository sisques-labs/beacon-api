import { Injectable } from '@nestjs/common';
import { BaseTypeOrmMapper } from '@sisques-labs/nestjs-kit/typeorm';

import { NotificationChannelDestinationAggregate } from '@contexts/notifications/domain/aggregates/notification-channel-destination.aggregate';
import { NotificationChannelDestinationBuilder } from '@contexts/notifications/domain/builders/notification-channel-destination.builder';
import { NotificationChannelDestinationViewModel } from '@contexts/notifications/domain/view-models/notification-channel-destination.view-model';
import { NotificationChannelDestinationEntity } from '@contexts/notifications/infrastructure/persistence/typeorm/entities/notification-channel-destination.entity';

@Injectable()
export class NotificationChannelDestinationTypeormMapper extends BaseTypeOrmMapper<
  NotificationChannelDestinationAggregate,
  NotificationChannelDestinationEntity
> {
  toAggregate(
    entity: NotificationChannelDestinationEntity,
  ): NotificationChannelDestinationAggregate {
    return this.buildFrom(entity).build();
  }

  toEntity(
    aggregate: NotificationChannelDestinationAggregate,
  ): NotificationChannelDestinationEntity {
    const primitives = aggregate.toPrimitives();
    const entity = new NotificationChannelDestinationEntity();

    entity.id = primitives.id;
    entity.tenantId = primitives.tenantId;
    entity.channel = primitives.channel;
    entity.encryptedAddress = primitives.envelope;
    entity.createdAt = this.normalizeDate(primitives.createdAt);
    entity.updatedAt = this.normalizeDate(primitives.updatedAt);

    return entity;
  }

  /**
   * Built directly from the entity's metadata columns, never through the
   * builder's `buildViewModel()`. The read repository (D10) never selects
   * `encryptedAddress`, so `entity.encryptedAddress` may be `undefined` here
   * — and the builder's shared `validate()` requires a non-empty envelope
   * for every build path. Constructing the view model directly keeps that
   * requirement honest for the write side while letting the read side never
   * touch the secret column at all.
   */
  toViewModel(
    entity: NotificationChannelDestinationEntity,
  ): NotificationChannelDestinationViewModel {
    return new NotificationChannelDestinationViewModel({
      id: entity.id,
      tenantId: entity.tenantId,
      channel: entity.channel,
      createdAt: this.normalizeDate(entity.createdAt),
      updatedAt: this.normalizeDate(entity.updatedAt),
    });
  }

  private buildFrom(
    entity: NotificationChannelDestinationEntity,
  ): NotificationChannelDestinationBuilder {
    return new NotificationChannelDestinationBuilder()
      .withId(entity.id)
      .withTenantId(entity.tenantId)
      .withChannel(entity.channel)
      .withEnvelope(entity.encryptedAddress)
      .withCreatedAt(this.normalizeDate(entity.createdAt))
      .withUpdatedAt(this.normalizeDate(entity.updatedAt));
  }
}
