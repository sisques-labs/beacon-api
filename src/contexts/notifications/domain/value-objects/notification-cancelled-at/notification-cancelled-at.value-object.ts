import { DateValueObject } from '@sisques-labs/nestjs-kit';

export class NotificationCancelledAtValueObject extends DateValueObject {
  constructor(date: Date) {
    super(date);
  }
}
