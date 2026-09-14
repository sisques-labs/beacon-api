import { StringValueObject } from '@sisques-labs/nestjs-kit';

export class NotificationBodyValueObject extends StringValueObject {
  static readonly MAX_LENGTH = 5000;

  constructor(value: string) {
    super(value, {
      maxLength: NotificationBodyValueObject.MAX_LENGTH,
      allowEmpty: false,
    });
  }
}
