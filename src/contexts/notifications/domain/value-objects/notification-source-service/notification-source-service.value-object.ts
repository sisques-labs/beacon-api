import { StringValueObject } from '@sisques-labs/nestjs-kit';

export class NotificationSourceServiceValueObject extends StringValueObject {
  static readonly MAX_LENGTH = 100;

  constructor(value: string) {
    super(value, {
      maxLength: NotificationSourceServiceValueObject.MAX_LENGTH,
      allowEmpty: false,
    });
  }
}
