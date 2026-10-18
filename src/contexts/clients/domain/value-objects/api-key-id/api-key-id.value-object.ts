import { StringValueObject } from '@sisques-labs/nestjs-kit';

/**
 * The public, loggable half of an API key (D16): 16 lowercase-hex
 * characters (8 random bytes), used as the unique lookup column for
 * `findByApiKeyId`. Unlike the secret half, `keyId` carries no entropy
 * requirement for redaction — it identifies a client, it does not
 * authenticate one.
 */
export class ApiKeyIdValueObject extends StringValueObject {
  static readonly LENGTH = 16;
  static readonly PATTERN = /^[0-9a-f]{16}$/;

  constructor(value: string) {
    super(value, {
      minLength: ApiKeyIdValueObject.LENGTH,
      maxLength: ApiKeyIdValueObject.LENGTH,
      allowEmpty: false,
      pattern: ApiKeyIdValueObject.PATTERN,
    });
  }
}
