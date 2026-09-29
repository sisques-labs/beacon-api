import { StringValueObject } from '@sisques-labs/nestjs-kit';

export class ClientNameValueObject extends StringValueObject {
  static readonly MAX_LENGTH = 100;

  constructor(value: string) {
    super(value, {
      maxLength: ClientNameValueObject.MAX_LENGTH,
      allowEmpty: false,
    });
  }
}
