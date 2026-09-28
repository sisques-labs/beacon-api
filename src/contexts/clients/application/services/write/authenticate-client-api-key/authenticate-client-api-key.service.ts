import { timingSafeEqual } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import {
  API_KEY_HASHER_PORT,
  IApiKeyHasherPort,
} from '@contexts/clients/application/ports/api-key-hasher.port';
import { AuthenticatedClientResult } from '@contexts/clients/application/services/write/authenticate-client-api-key/authenticated-client-result.interface';
import {
  CLIENT_WRITE_REPOSITORY,
  IClientWriteRepository,
} from '@contexts/clients/domain/repositories/write/client-write.repository';

/** Strict `bcn_{keyId}_{secret}` format (design.md D16). */
const API_KEY_PATTERN = /^bcn_([0-9a-f]{16})_([A-Za-z0-9_-]{43})$/;

/**
 * A fixed-length dummy hash, the same shape as a real
 * `ApiKeySecretHashValueObject` digest (64 lowercase-hex characters). Used
 * as the comparison target when `keyId` does not exist, so an unknown
 * `keyId` costs the same `timingSafeEqual` work as a known one — this
 * removes keyId existence as a timing oracle (D17).
 */
const DUMMY_HASH = '0'.repeat(64);

/**
 * Resolves an API key credential to its owning client (design.md D17 Data
 * Flow). Every failure path — malformed format, unknown `keyId`, secret
 * mismatch, or a revoked client — returns `null`. It never throws for an
 * authentication failure; only an infrastructure error from the repository
 * propagates. Never logs the credential or its secret half.
 */
@Injectable()
export class AuthenticateClientApiKeyService {
  constructor(
    @Inject(CLIENT_WRITE_REPOSITORY)
    private readonly writeRepository: IClientWriteRepository,
    @Inject(API_KEY_HASHER_PORT)
    private readonly apiKeyHasherPort: IApiKeyHasherPort,
  ) {}

  async execute(
    credential: string | undefined,
  ): Promise<AuthenticatedClientResult | null> {
    if (!credential) {
      return null;
    }

    const match = API_KEY_PATTERN.exec(credential);
    if (!match) {
      return null;
    }
    const [, keyId, secret] = match;

    const client = await this.writeRepository.findByApiKeyId(keyId);
    const storedHash = client?.apiKeySecretHash.value ?? DUMMY_HASH;
    const candidateHash = this.apiKeyHasherPort.hash(secret);

    const matches = timingSafeEqual(
      Buffer.from(candidateHash, 'hex'),
      Buffer.from(storedHash, 'hex'),
    );

    if (!client || !matches || client.revokedAt !== null) {
      return null;
    }

    return { clientId: client.id.value, tenantId: client.tenantId.value };
  }
}
