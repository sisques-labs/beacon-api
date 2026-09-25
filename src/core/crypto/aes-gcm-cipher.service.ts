import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ICryptoConfig } from '@core/config/interfaces/crypto-config.interface';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12;
const ENVELOPE_PART_COUNT = 4;

/**
 * Context-agnostic AES-256-GCM encryption service (design.md D4/D5/D6).
 *
 * Produces and consumes a self-describing envelope
 * `v{keyVersion}:{iv}:{authTag}:{ciphertext}`, all parts base64url-encoded,
 * meant to be stored as a single `text` column. Every `encrypt()` call uses a
 * fresh 12-byte IV. Callers MUST pass the same AAD to `decrypt()` that they
 * passed to `encrypt()` — a mismatch (or any tampering of the envelope) fails
 * the GCM auth tag check and throws, never returning a partial/garbled value.
 *
 * Core has no notion of "context" — this service knows nothing about
 * `notifications` or any other bounded context. It is wired `@Global` via
 * `CryptoModule` and consumed behind a per-context port (`ISecretCipherPort`)
 * so hexagonal boundaries stay intact.
 */
@Injectable()
export class AesGcmCipherService {
  private readonly key: Buffer;
  private readonly keyVersion: number;

  constructor(configService: ConfigService) {
    const config = configService.getOrThrow<ICryptoConfig>('crypto');
    this.key = config.key;
    this.keyVersion = config.keyVersion;
  }

  encrypt(plaintext: string, aad: string): string {
    const iv = randomBytes(IV_LENGTH_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    cipher.setAAD(Buffer.from(aad, 'utf8'));

    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return [
      `v${this.keyVersion}`,
      iv.toString('base64url'),
      authTag.toString('base64url'),
      ciphertext.toString('base64url'),
    ].join(':');
  }

  decrypt(envelope: string, aad: string): string {
    const parts = envelope.split(':');

    if (parts.length !== ENVELOPE_PART_COUNT) {
      throw new Error('Malformed encryption envelope');
    }

    const [versionPart, ivPart, authTagPart, ciphertextPart] = parts;
    const version = this.parseVersion(versionPart);

    if (version !== this.keyVersion) {
      throw new Error(`Unknown encryption key version: ${versionPart}`);
    }

    const iv = Buffer.from(ivPart, 'base64url');
    const authTag = Buffer.from(authTagPart, 'base64url');
    const ciphertext = Buffer.from(ciphertextPart, 'base64url');

    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(authTag);
    decipher.setAAD(Buffer.from(aad, 'utf8'));

    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return plaintext.toString('utf8');
  }

  private parseVersion(versionPart: string): number {
    const match = /^v(\d+)$/.exec(versionPart);

    if (!match) {
      throw new Error(`Malformed encryption envelope version: ${versionPart}`);
    }

    return Number(match[1]);
  }
}
