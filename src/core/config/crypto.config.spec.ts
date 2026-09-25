import { cryptoConfig } from '@core/config/crypto.config';

const VALID_KEY = Buffer.alloc(32, 9).toString('base64');

describe('cryptoConfig', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.SECRETS_ENCRYPTION_KEY;
    delete process.env.SECRETS_ENCRYPTION_KEY_VERSION;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('decodes SECRETS_ENCRYPTION_KEY from base64 into a 32-byte key buffer', () => {
    process.env.SECRETS_ENCRYPTION_KEY = VALID_KEY;

    const config = cryptoConfig();

    expect(config.key).toEqual(Buffer.alloc(32, 9));
    expect(config.key).toHaveLength(32);
  });

  it('defaults keyVersion to 1 when SECRETS_ENCRYPTION_KEY_VERSION is unset', () => {
    process.env.SECRETS_ENCRYPTION_KEY = VALID_KEY;

    expect(cryptoConfig().keyVersion).toBe(1);
  });

  it('reads a custom keyVersion from SECRETS_ENCRYPTION_KEY_VERSION', () => {
    process.env.SECRETS_ENCRYPTION_KEY = VALID_KEY;
    process.env.SECRETS_ENCRYPTION_KEY_VERSION = '7';

    expect(cryptoConfig().keyVersion).toBe(7);
  });
});
