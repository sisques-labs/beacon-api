import { BaseException } from '@sisques-labs/nestjs-kit';

export class NotificationNotFoundException extends BaseException {
  constructor(id: string) {
    super(`Notification with id '${id}' was not found`);
  }
}
