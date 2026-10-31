import { cryptoConfig } from '@core/config/crypto.config';

const VALID_KEY = Buffer.alloc(32, 9).toString('base64');

describe('cryptoConfig', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.SECRETS_ENCRYPTION_KEY;
    delete process.env.SECRETS_ENCRYPTION_KEY_VERSION;
    for (const name of Object.keys(process.env)) {
      if (/^SECRETS_ENCRYPTION_KEY_\d+$/.test(name)) {
        delete process.env[name];
      }
    }
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

  it('collects previous keys from SECRETS_ENCRYPTION_KEY_<n>', () => {
    process.env.SECRETS_ENCRYPTION_KEY = VALID_KEY;
    process.env.SECRETS_ENCRYPTION_KEY_VERSION = '2';
    process.env.SECRETS_ENCRYPTION_KEY_1 = Buffer.alloc(32, 1).toString(
      'base64',
    );

    const config = cryptoConfig();

    expect(config.keyVersion).toBe(2);
    expect(config.previousKeys.get(1)).toEqual(Buffer.alloc(32, 1));
    expect(config.previousKeys.size).toBe(1);
  });

  it('rejects an empty SECRETS_ENCRYPTION_KEY_VERSION', () => {
    process.env.SECRETS_ENCRYPTION_KEY = VALID_KEY;
    process.env.SECRETS_ENCRYPTION_KEY_VERSION = '';

    expect(() => cryptoConfig()).toThrow(/SECRETS_ENCRYPTION_KEY_VERSION/);
  });

  it.each(['abc', '1.5', '0', '256', '01', '1e1'])(
    'rejects SECRETS_ENCRYPTION_KEY_VERSION=%s',
    (version) => {
      process.env.SECRETS_ENCRYPTION_KEY = VALID_KEY;
      process.env.SECRETS_ENCRYPTION_KEY_VERSION = version;

      expect(() => cryptoConfig()).toThrow(/SECRETS_ENCRYPTION_KEY_VERSION/);
    },
  );

  it('rejects a malformed current key (typo character)', () => {
    process.env.SECRETS_ENCRYPTION_KEY = `${VALID_KEY.slice(0, 10)}!${VALID_KEY.slice(11)}`;

    expect(() => cryptoConfig()).toThrow(/SECRETS_ENCRYPTION_KEY/);
  });

  it('rejects a current key that is not 32 bytes', () => {
    process.env.SECRETS_ENCRYPTION_KEY = Buffer.alloc(16, 1).toString('base64');

    expect(() => cryptoConfig()).toThrow(/SECRETS_ENCRYPTION_KEY/);
  });

  it('rejects a malformed previous key', () => {
    process.env.SECRETS_ENCRYPTION_KEY = VALID_KEY;
    process.env.SECRETS_ENCRYPTION_KEY_VERSION = '2';
    process.env.SECRETS_ENCRYPTION_KEY_1 = 'not-a-valid-key';

    expect(() => cryptoConfig()).toThrow(/SECRETS_ENCRYPTION_KEY_1/);
  });

  it('rejects a previous key whose suffix is not a valid version', () => {
    process.env.SECRETS_ENCRYPTION_KEY = VALID_KEY;
    process.env.SECRETS_ENCRYPTION_KEY_V1 = VALID_KEY;

    expect(() => cryptoConfig()).toThrow(/SECRETS_ENCRYPTION_KEY_V1/);
  });

  it('rejects a previous key that reuses the current version', () => {
    process.env.SECRETS_ENCRYPTION_KEY = VALID_KEY;
    process.env.SECRETS_ENCRYPTION_KEY_VERSION = '2';
    process.env.SECRETS_ENCRYPTION_KEY_2 = VALID_KEY;

    expect(() => cryptoConfig()).toThrow(/SECRETS_ENCRYPTION_KEY_2/);
  });
});
