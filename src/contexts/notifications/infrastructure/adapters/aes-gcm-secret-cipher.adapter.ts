import { Injectable } from '@nestjs/common';

import { AesGcmCipherService } from '@core/crypto/aes-gcm-cipher.service';
import { ISecretCipherPort } from '@contexts/notifications/application/ports/secret-cipher.port';

/**
 * Thin `notifications`-scoped adapter over the core, context-agnostic
 * `AesGcmCipherService` (design.md D6). Keeps the hexagonal boundary: the
 * domain/application layers depend on `ISecretCipherPort`, never directly
 * on `@core/crypto`.
 */
@Injectable()
export class AesGcmSecretCipherAdapter implements ISecretCipherPort {
  constructor(private readonly cipherService: AesGcmCipherService) {}

  encrypt(plaintext: string, aad: string): string {
    return this.cipherService.encrypt(plaintext, aad);
  }

  decrypt(envelope: string, aad: string): string {
    return this.cipherService.decrypt(envelope, aad);
  }
}
