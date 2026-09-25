import { IBaseReadRepository } from '@sisques-labs/nestjs-kit';

import { NotificationChannelDestinationViewModel } from '@contexts/notifications/domain/view-models/notification-channel-destination.view-model';

export const NOTIFICATION_CHANNEL_DESTINATION_READ_REPOSITORY = Symbol(
  'NOTIFICATION_CHANNEL_DESTINATION_READ_REPOSITORY',
);

export interface INotificationChannelDestinationReadRepository extends IBaseReadRepository<NotificationChannelDestinationViewModel> {
  findByTenantAndChannel(
    tenantId: string,
    channel: string,
  ): Promise<NotificationChannelDestinationViewModel | null>;
}
