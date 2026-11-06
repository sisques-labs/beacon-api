import { BaseException } from '@sisques-labs/nestjs-kit';

export class DestinationAlreadyExistsException extends BaseException {
  constructor(tenantId: string, channel: string) {
    super(
      `Notification channel destination with tenantId '${tenantId}' and channel '${channel}' already exists`,
    );
  }
}
