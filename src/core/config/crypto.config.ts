import { registerAs } from '@nestjs/config';

import { parseCryptoEnv } from '@core/config/crypto-env.parser';
import { ICryptoConfig } from '@core/config/interfaces/crypto-config.interface';

/**
 * AES-256-GCM secrets encryption keyring (design.md D4). The current key
 * (`SECRETS_ENCRYPTION_KEY` + optional `SECRETS_ENCRYPTION_KEY_VERSION`,
 * default `1`) encrypts new data; retired keys are supplied as
 * `SECRETS_ENCRYPTION_KEY_<n>` so envelopes written under an older version
 * remain decryptable after a rotation. Parsing and strict validation live in
 * `crypto-env.parser.ts`, shared with `env.validation.ts`.
 */
export const cryptoConfig = registerAs('crypto', (): ICryptoConfig =>
  parseCryptoEnv(process.env),
);
