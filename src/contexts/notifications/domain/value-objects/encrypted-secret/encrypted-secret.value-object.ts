import { inspect } from 'node:util';

import { InvalidStringException, ValueObject } from '@sisques-labs/nestjs-kit';

const REDACTED_LABEL = '[REDACTED:encrypted-secret]';

/**
 * Wraps an encrypted secret envelope (D4 format:
 * `v{keyVersion}:{iv}:{authTag}:{ciphertext}`) so it can travel through the
 * domain without ever being written to a log, an error message, or a JSON
 * serialization by accident. `.value` is the only way to read the raw
 * envelope, and callers that need it MUST pass it to `ISecretCipherPort`
 * explicitly.
 */
export class EncryptedSecretValueObject extends ValueObject<string> {
  private readonly _value: string;

  constructor(envelope: string) {
    super();
    this._value = envelope;
    this.validate();
  }

  get value(): string {
    return this._value;
  }

  protected validate(): void {
    if (this._value.trim().length === 0) {
      throw new InvalidStringException(
        'Encrypted secret envelope cannot be empty',
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
