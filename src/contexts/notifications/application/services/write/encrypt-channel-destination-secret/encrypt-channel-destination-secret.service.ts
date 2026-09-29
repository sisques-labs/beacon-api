import { Inject, Injectable } from '@nestjs/common';
import { IBaseService } from '@sisques-labs/nestjs-kit';

import {
  ISecretCipherPort,
  SECRET_CIPHER_PORT,
} from '@contexts/notifications/application/ports/secret-cipher.port';

export interface EncryptChannelDestinationSecretInput {
  tenantId: string;
  channel: string;
  plaintext: string;
}

/**
 * Encrypts a channel destination secret (e.g. a webhook URL) into the stored
 * envelope, and is the single owner of the "encryption context" format.
 *
 * The encryption context is a label (`notifications:channel-destination:
 * {tenantId}:{channel}`) that is cryptographically bound to the ciphertext
 * (AES-GCM "additional authenticated data"). It is not secret and is not
 * stored: it is recomputed on every encrypt/decrypt. Decryption only succeeds
 * with the exact same label, so an envelope copied to another tenant's or
 * channel's row can never be decrypted there.
 *
 * Any code that decrypts these envelopes MUST obtain the context from
 * `buildEncryptionContext` so both sides always agree.
 */
@Injectable()
export class EncryptChannelDestinationSecretService implements IBaseService<
  EncryptChannelDestinationSecretInput,
  string
> {
  constructor(
    @Inject(SECRET_CIPHER_PORT)
    private readonly secretCipherPort: ISecretCipherPort,
  ) {}

  async execute(input: EncryptChannelDestinationSecretInput): Promise<string> {
    const encryptionContext = this.buildEncryptionContext(
      input.tenantId,
      input.channel,
    );
    return this.secretCipherPort.encrypt(input.plaintext, encryptionContext);
  }

  buildEncryptionContext(tenantId: string, channel: string): string {
    return `notifications:channel-destination:${tenantId}:${channel}`;
  }
}
