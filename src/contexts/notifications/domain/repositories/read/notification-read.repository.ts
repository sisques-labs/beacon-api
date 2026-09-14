import { IBaseReadRepository } from '@sisques-labs/nestjs-kit';

import { NotificationViewModel } from '@contexts/notifications/domain/view-models/notification.view-model';

export const NOTIFICATION_READ_REPOSITORY = Symbol(
  'NOTIFICATION_READ_REPOSITORY',
);

export type INotificationReadRepository =
  IBaseReadRepository<NotificationViewModel>;
