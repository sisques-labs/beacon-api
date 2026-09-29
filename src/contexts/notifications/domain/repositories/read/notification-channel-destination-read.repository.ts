import { IBaseReadRepository } from '@sisques-labs/nestjs-kit';

import { NotificationChannelDestinationViewModel } from '@contexts/notifications/domain/view-models/notification-channel-destination.view-model';

export const NOTIFICATION_CHANNEL_DESTINATION_READ_REPOSITORY = Symbol(
  'NOTIFICATION_CHANNEL_DESTINATION_READ_REPOSITORY',
);

/**
 * Lookups go through the two generic entry points inherited from the base
 * contract: `findById` and `findByCriteria` (a `(tenantId, channel)` lookup is
 * an equality criteria on those two fields).
 */
export type INotificationChannelDestinationReadRepository =
  IBaseReadRepository<NotificationChannelDestinationViewModel>;
