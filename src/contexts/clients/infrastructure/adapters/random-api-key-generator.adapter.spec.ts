import { RandomApiKeyGeneratorAdapter } from '@contexts/clients/infrastructure/adapters/random-api-key-generator.adapter';

const KEY_PATTERN = /^bcn_([0-9a-f]{16})_([A-Za-z0-9_-]{43})$/;

describe('RandomApiKeyGeneratorAdapter', () => {
  let adapter: RandomApiKeyGeneratorAdapter;

  beforeEach(() => {
    adapter = new RandomApiKeyGeneratorAdapter();
  });

  it('generates a key matching the fixed bcn_{keyId}_{secret} format (D16)', () => {
    const generated = adapter.generate();

    expect(generated.key).toMatch(KEY_PATTERN);
    expect(generated.key).toHaveLength(64);
  });

  it('splits keyId and secret out to match the parts embedded in key', () => {
    const generated = adapter.generate();
    const match = KEY_PATTERN.exec(generated.key);

    expect(match).not.toBeNull();
    expect(generated.keyId).toBe(match?.[1]);
    expect(generated.secret).toBe(match?.[2]);
    expect(generated.keyId).toMatch(/^[0-9a-f]{16}$/);
    expect(generated.secret).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('never produces the same key, keyId, or secret across two calls', () => {
    const first = adapter.generate();
    const second = adapter.generate();

    expect(second.key).not.toBe(first.key);
    expect(second.keyId).not.toBe(first.keyId);
    expect(second.secret).not.toBe(first.secret);
  });
});
