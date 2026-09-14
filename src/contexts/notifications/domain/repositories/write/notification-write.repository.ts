import { IBaseWriteRepository } from '@sisques-labs/nestjs-kit';

import { NotificationAggregate } from '@contexts/notifications/domain/aggregates/notification.aggregate';

export const NOTIFICATION_WRITE_REPOSITORY = Symbol(
  'NOTIFICATION_WRITE_REPOSITORY',
);

export interface INotificationWriteRepository extends IBaseWriteRepository<NotificationAggregate> {
  findByDedupeKey(
    tenantId: string,
    dedupeKey: string,
  ): Promise<NotificationAggregate | null>;
}
