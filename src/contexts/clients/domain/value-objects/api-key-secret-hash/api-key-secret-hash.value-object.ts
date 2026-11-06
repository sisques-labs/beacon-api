import { inspect } from 'node:util';

import { InvalidStringException, ValueObject } from '@sisques-labs/nestjs-kit';

const REDACTED_LABEL = '[REDACTED:api-key-secret-hash]';

/**
 * Wraps the SHA-256 hex digest of an API key secret (D17): 64
 * lowercase-hex characters. Mirrors `EncryptedSecretValueObject` — the
 * digest never reaches a log line, an error message, or a JSON
 * serialization. `.value` is the only way to read it, for
 * `crypto.timingSafeEqual` comparison during authentication.
 */
export class ApiKeySecretHashValueObject extends ValueObject<string> {
  static readonly LENGTH = 64;
  static readonly PATTERN = /^[0-9a-f]{64}$/;

  private readonly _value: string;

  constructor(value: string) {
    super();
    this._value = value;
    this.validate();
  }

  get value(): string {
    return this._value;
  }

  protected validate(): void {
    if (!ApiKeySecretHashValueObject.PATTERN.test(this._value)) {
      throw new InvalidStringException(
        'API key secret hash must be exactly 64 lowercase-hex characters',
      );
    }
  }

  override toString(): string {
    return REDACTED_LABEL;
  }

  toJSON(): string {
    return REDACTED_LABEL;
  }

  [inspect.custom](): string {
    return REDACTED_LABEL;
  }
}
