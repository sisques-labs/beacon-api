import { StringValueObject } from '@sisques-labs/nestjs-kit';

export class NotificationFailureReasonValueObject extends StringValueObject {
  static readonly MAX_LENGTH = 1000;

  constructor(value: string) {
    super(value, {
      maxLength: NotificationFailureReasonValueObject.MAX_LENGTH,
      allowEmpty: false,
    });
  }
}
