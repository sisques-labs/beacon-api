import { registerAs } from '@nestjs/config';

import { ICryptoConfig } from '@core/config/interfaces/crypto-config.interface';

/**
 * AES-256-GCM secrets encryption key (design.md D4). `SECRETS_ENCRYPTION_KEY`
 * is required and validated by `env.validation.ts` to decode to exactly 32
 * bytes before this factory ever runs. `SECRETS_ENCRYPTION_KEY_VERSION` is
 * optional, defaulting to `1` — a future key rotation bumps it and the
 * envelope's version prefix records which key encrypted each row.
 */
export const cryptoConfig = registerAs('crypto', (): ICryptoConfig => ({
  key: Buffer.from(process.env.SECRETS_ENCRYPTION_KEY ?? '', 'base64'),
  keyVersion: parseInt(process.env.SECRETS_ENCRYPTION_KEY_VERSION ?? '1', 10),
}));
