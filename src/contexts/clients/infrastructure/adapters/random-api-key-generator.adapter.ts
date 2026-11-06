import { randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { IApiKeyGeneratorPort } from '@contexts/clients/application/ports/api-key-generator.port';
import { IGeneratedApiKey } from '@contexts/clients/application/ports/generated-api-key.interface';

const KEY_PREFIX = 'bcn';
const KEY_ID_BYTES = 8; // 16 lowercase-hex characters
const SECRET_BYTES = 32; // 256 bits, 43 base64url characters

/**
 * Generates a new API key from a CSPRNG (design.md D16):
 * `bcn_{keyId}_{secret}`, where `keyId` is 8 random bytes as lowercase hex
 * (16 characters, public, used for lookup) and `secret` is 32 random bytes
 * as base64url (43 characters, 256 bits of entropy).
 */
@Injectable()
export class RandomApiKeyGeneratorAdapter implements IApiKeyGeneratorPort {
  generate(): IGeneratedApiKey {
    const keyId = randomBytes(KEY_ID_BYTES).toString('hex');
    const secret = randomBytes(SECRET_BYTES).toString('base64url');

    return {
      key: `${KEY_PREFIX}_${keyId}_${secret}`,
      keyId,
      secret,
    };
  }
}
