import { DateValueObject } from '@sisques-labs/nestjs-kit';

export class NotificationReadAtValueObject extends DateValueObject {
  constructor(date: Date) {
    super(date);
  }
}
