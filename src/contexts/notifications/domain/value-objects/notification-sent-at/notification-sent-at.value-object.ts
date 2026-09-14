import { DateValueObject } from '@sisques-labs/nestjs-kit';

export class NotificationSentAtValueObject extends DateValueObject {
  constructor(date: Date) {
    super(date);
  }
}
