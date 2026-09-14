import { BaseException } from '@sisques-labs/nestjs-kit';

export class NotificationDedupeKeyAlreadyExistsException extends BaseException {
  constructor(tenantId: string, dedupeKey: string) {
    super(
      `Notification with tenantId '${tenantId}' and dedupeKey '${dedupeKey}' already exists`,
    );
  }
}
