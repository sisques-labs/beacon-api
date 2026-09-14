import { StringValueObject } from '@sisques-labs/nestjs-kit';

export class NotificationTitleValueObject extends StringValueObject {
  static readonly MAX_LENGTH = 200;

  constructor(value: string) {
    super(value, {
      maxLength: NotificationTitleValueObject.MAX_LENGTH,
      allowEmpty: false,
    });
  }
}
