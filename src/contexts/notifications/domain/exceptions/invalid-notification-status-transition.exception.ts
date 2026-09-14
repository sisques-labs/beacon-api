import { BaseException } from '@sisques-labs/nestjs-kit';

export class InvalidNotificationStatusTransitionException extends BaseException {
  constructor(from: string, to: string) {
    super(`Invalid notification status transition from '${from}' to '${to}'`);
  }
}
