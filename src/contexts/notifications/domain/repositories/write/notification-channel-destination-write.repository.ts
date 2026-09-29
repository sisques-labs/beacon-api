import { IBaseWriteRepository } from '@sisques-labs/nestjs-kit';

import { NotificationChannelDestinationAggregate } from '@contexts/notifications/domain/aggregates/notification-channel-destination.aggregate';

export const NOTIFICATION_CHANNEL_DESTINATION_WRITE_REPOSITORY = Symbol(
  'NOTIFICATION_CHANNEL_DESTINATION_WRITE_REPOSITORY',
);

/**
 * Lookups go through the two generic entry points inherited from the base
 * contract: `findById` and `findByCriteria` (a `(tenantId, channel)` lookup is
 * an equality criteria on those two fields).
 */
export type INotificationChannelDestinationWriteRepository =
  IBaseWriteRepository<NotificationChannelDestinationAggregate>;
