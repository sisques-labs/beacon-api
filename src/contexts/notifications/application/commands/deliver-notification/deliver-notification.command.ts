import { BooleanValueObject, UuidValueObject } from '@sisques-labs/nestjs-kit';

export interface DeliverNotificationCommandInput {
  notificationId: string;
  /**
   * Whether this is the last attempt BullMQ will make (design.md D4).
   * Derived by the processor from `job.attemptsMade + 1 >= job.opts.attempts`
   * — the only place BullMQ job state is allowed to leak, since transport
   * stays bus-only otherwise.
   */
  isFinalAttempt: boolean;
}

export class DeliverNotificationCommand {
  public readonly notificationId: UuidValueObject;
  public readonly isFinalAttempt: BooleanValueObject;

  constructor(input: DeliverNotificationCommandInput) {
    this.notificationId = new UuidValueObject(input.notificationId);
    this.isFinalAttempt = new BooleanValueObject(input.isFinalAttempt);
  }
}
