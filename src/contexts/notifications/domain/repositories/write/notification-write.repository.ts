import { IBaseWriteRepository } from '@sisques-labs/nestjs-kit';

import { NotificationAggregate } from '@contexts/notifications/domain/aggregates/notification.aggregate';

export const NOTIFICATION_WRITE_REPOSITORY = Symbol(
  'NOTIFICATION_WRITE_REPOSITORY',
);

export type INotificationWriteRepository =
  IBaseWriteRepository<NotificationAggregate>;
