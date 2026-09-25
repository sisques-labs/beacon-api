import { IBaseWriteRepository } from '@sisques-labs/nestjs-kit';

import { NotificationChannelDestinationAggregate } from '@contexts/notifications/domain/aggregates/notification-channel-destination.aggregate';

export const NOTIFICATION_CHANNEL_DESTINATION_WRITE_REPOSITORY = Symbol(
  'NOTIFICATION_CHANNEL_DESTINATION_WRITE_REPOSITORY',
);

export interface INotificationChannelDestinationWriteRepository extends IBaseWriteRepository<NotificationChannelDestinationAggregate> {
  findByTenantAndChannel(
    tenantId: string,
    channel: string,
  ): Promise<NotificationChannelDestinationAggregate | null>;
}
