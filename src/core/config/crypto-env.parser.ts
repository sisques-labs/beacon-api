import { ICryptoConfig } from '@core/config/interfaces/crypto-config.interface';

const CURRENT_KEY_VAR = 'SECRETS_ENCRYPTION_KEY';
const CURRENT_VERSION_VAR = 'SECRETS_ENCRYPTION_KEY_VERSION';
const PREVIOUS_KEY_PREFIX = `${CURRENT_KEY_VAR}_`;

const DEFAULT_KEY_VERSION = 1;
const MIN_KEY_VERSION = 1;
const MAX_KEY_VERSION = 255;
const KEY_LENGTH_BYTES = 32;
// 32 bytes -> 43 base64 characters plus exactly one '=' pad.
const STRICT_BASE64_KEY_PATTERN = /^[A-Za-z0-9+/]{43}=$/;
const VERSION_PATTERN = /^[1-9]\d*$/;

function readVar(
  env: Record<string, unknown>,
  name: string,
): string | undefined {
  const value = env[name];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new Error(`${name} must be a string`);
  }

  return value.trim();
}

function parseKey(name: string, raw: string | undefined): Buffer {
  if (raw === undefined || raw.length === 0) {
    throw new Error(`${name} must not be empty`);
  }

  if (!STRICT_BASE64_KEY_PATTERN.test(raw)) {
    throw new Error(
      `${name} must be canonical base64 (43 characters followed by "=")`,
    );
  }

  const key = Buffer.from(raw, 'base64');

  if (key.length !== KEY_LENGTH_BYTES || key.toString('base64') !== raw) {
    throw new Error(
      `${name} must be base64-encoded and decode to exactly ${KEY_LENGTH_BYTES} bytes`,
    );
  }

  return key;
}

function parseVersion(name: string, raw: string): number {
  const version = VERSION_PATTERN.test(raw) ? Number(raw) : Number.NaN;

  if (
    !Number.isInteger(version) ||
    version < MIN_KEY_VERSION ||
    version > MAX_KEY_VERSION
  ) {
    throw new Error(
      `${name} must be an integer between ${MIN_KEY_VERSION} and ${MAX_KEY_VERSION}`,
    );
  }

  return version;
}

/**
 * Single place where the encryption keyring is parsed and validated. Used by
 * both `env.validation.ts` (fail fast at boot) and `crypto.config.ts`.
 *
 * - `SECRETS_ENCRYPTION_KEY` + `SECRETS_ENCRYPTION_KEY_VERSION` (default 1)
 *   define the current key used for encryption.
 * - `SECRETS_ENCRYPTION_KEY_<n>` define previous keys kept for decryption
 *   during key rotation.
 *
 * Throws an `Error` with a message naming the offending variable.
 */
export function parseCryptoEnv(env: Record<string, unknown>): ICryptoConfig {
  const rawVersion = readVar(env, CURRENT_VERSION_VAR);
  const keyVersion =
    rawVersion === undefined
      ? DEFAULT_KEY_VERSION
      : parseVersion(CURRENT_VERSION_VAR, rawVersion);
  const key = parseKey(CURRENT_KEY_VAR, readVar(env, CURRENT_KEY_VAR));

  const previousKeys = new Map<number, Buffer>();

  for (const name of Object.keys(env)) {
    if (
      !name.startsWith(PREVIOUS_KEY_PREFIX) ||
      name === CURRENT_VERSION_VAR ||
      env[name] === undefined
    ) {
      continue;
    }

    const version = parseVersion(name, name.slice(PREVIOUS_KEY_PREFIX.length));

    if (version === keyVersion) {
      throw new Error(
        `${name} conflicts with the current key version ${keyVersion}; the current key is ${CURRENT_KEY_VAR}`,
      );
    }

    previousKeys.set(version, parseKey(name, readVar(env, name)));
  }

  return { key, keyVersion, previousKeys };
}
