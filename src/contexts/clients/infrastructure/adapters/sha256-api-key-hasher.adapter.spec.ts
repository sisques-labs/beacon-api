import { createHash } from 'node:crypto';

import { Sha256ApiKeyHasherAdapter } from '@contexts/clients/infrastructure/adapters/sha256-api-key-hasher.adapter';

describe('Sha256ApiKeyHasherAdapter', () => {
  let adapter: Sha256ApiKeyHasherAdapter;

  beforeEach(() => {
    adapter = new Sha256ApiKeyHasherAdapter();
  });

  it('hashes a secret to a 64-character lowercase-hex SHA-256 digest (D17)', () => {
    const hash = adapter.hash('some-secret-value');

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(
      createHash('sha256').update('some-secret-value', 'utf8').digest('hex'),
    );
  });

  it('is deterministic: the same secret always hashes to the same digest', () => {
    expect(adapter.hash('a-fixed-secret')).toBe(adapter.hash('a-fixed-secret'));
  });

  it('produces different digests for different secrets', () => {
    expect(adapter.hash('secret-one')).not.toBe(adapter.hash('secret-two'));
  });
});
