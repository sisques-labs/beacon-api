import { inspect } from 'node:util';

import { ApiKeySecretHashValueObject } from '@contexts/clients/domain/value-objects/api-key-secret-hash/api-key-secret-hash.value-object';

describe('ApiKeySecretHashValueObject', () => {
  const hash =
    'a1b2c3d4e5f60789a1b2c3d4e5f60789a1b2c3d4e5f60789a1b2c3d4e5f60789';

  it('wraps a valid 64-char lowercase-hex hash and exposes it verbatim via .value', () => {
    expect(new ApiKeySecretHashValueObject(hash).value).toBe(hash);
  });

  it('wraps a different valid 64-char lowercase-hex hash too (triangulation)', () => {
    const otherHash = '0011223344556677'.repeat(4);

    expect(new ApiKeySecretHashValueObject(otherHash).value).toBe(otherHash);
  });

  it('throws for a hash shorter than 64 characters', () => {
    expect(() => new ApiKeySecretHashValueObject(hash.slice(0, 63))).toThrow();
  });

  it('throws for a hash longer than 64 characters', () => {
    expect(() => new ApiKeySecretHashValueObject(`${hash}f`)).toThrow();
  });

  it('throws for a hash containing uppercase-hex characters', () => {
    expect(() => new ApiKeySecretHashValueObject(hash.toUpperCase())).toThrow();
  });

  it('throws for a hash containing non-hex characters', () => {
    expect(
      () => new ApiKeySecretHashValueObject(`g${hash.slice(1)}`),
    ).toThrow();
  });

  it('never exposes the hash via toString()', () => {
    const vo = new ApiKeySecretHashValueObject(hash);

    expect(vo.toString()).not.toContain(hash);
  });

  it('never exposes the hash via JSON.stringify()', () => {
    const vo = new ApiKeySecretHashValueObject(hash);

    expect(JSON.stringify(vo)).not.toContain(hash);
  });

  it('never exposes the hash via JSON.stringify() when nested in an object', () => {
    const serialized = JSON.stringify({
      apiKeySecretHash: new ApiKeySecretHashValueObject(hash),
    });

    expect(serialized).not.toContain(hash);
  });

  it('never exposes the hash via console.log/util.inspect formatting', () => {
    const vo = new ApiKeySecretHashValueObject(hash);

    expect(inspect(vo)).not.toContain(hash);
  });
});
