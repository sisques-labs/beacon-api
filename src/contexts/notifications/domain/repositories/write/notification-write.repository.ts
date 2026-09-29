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

  /**
   * Persists the aggregate only if its row already exists, as one atomic
   * `UPDATE` — never an insert. Returns `false` (no write performed) when
   * the row is gone. Unlike `save()` (an id-based upsert), this can never
   * resurrect a notification whose row was deleted after it was read
   * (design.md D1/D2 delivery fail-closed persistence).
   */
  updateIfExists(entity: NotificationAggregate): Promise<boolean>;
}
