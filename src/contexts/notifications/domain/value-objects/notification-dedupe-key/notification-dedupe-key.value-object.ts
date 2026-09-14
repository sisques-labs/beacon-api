import { StringValueObject } from '@sisques-labs/nestjs-kit';

export class NotificationDedupeKeyValueObject extends StringValueObject {
  static readonly MAX_LENGTH = 255;

  constructor(value: string) {
    super(value, {
      maxLength: NotificationDedupeKeyValueObject.MAX_LENGTH,
      allowEmpty: false,
    });
  }
}
