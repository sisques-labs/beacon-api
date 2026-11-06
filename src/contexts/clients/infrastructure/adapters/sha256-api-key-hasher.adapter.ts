import { createHash } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { IApiKeyHasherPort } from '@contexts/clients/application/ports/api-key-hasher.port';

/**
 * SHA-256-hashes an API key secret (design.md D17): a plain, deterministic
 * hex digest. Constant-time verification against a stored (or dummy) hash
 * is NOT this adapter's job — `AuthenticateClientApiKeyService` (Phase 17)
 * owns the `crypto.timingSafeEqual` comparison.
 */
@Injectable()
export class Sha256ApiKeyHasherAdapter implements IApiKeyHasherPort {
  hash(secret: string): string {
    return createHash('sha256').update(secret, 'utf8').digest('hex');
  }
}
