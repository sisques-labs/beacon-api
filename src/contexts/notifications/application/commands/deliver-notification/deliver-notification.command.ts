import { UuidValueObject } from '@sisques-labs/nestjs-kit';

export interface DeliverNotificationCommandInput {
  notificationId: string;
}

export class DeliverNotificationCommand {
  public readonly notificationId: UuidValueObject;

  constructor(input: DeliverNotificationCommandInput) {
    this.notificationId = new UuidValueObject(input.notificationId);
  }
}
