import { ApiKeyIdValueObject } from '@contexts/clients/domain/value-objects/api-key-id/api-key-id.value-object';

describe('ApiKeyIdValueObject', () => {
  it('wraps a valid 16-char lowercase-hex keyId', () => {
    const keyId = 'a1b2c3d4e5f60789';

    expect(new ApiKeyIdValueObject(keyId).value).toBe(keyId);
  });

  it('wraps a different valid 16-char lowercase-hex keyId too (triangulation)', () => {
    const keyId = '0011223344556677';

    expect(new ApiKeyIdValueObject(keyId).value).toBe(keyId);
  });

  it('throws for a keyId shorter than 16 characters', () => {
    expect(() => new ApiKeyIdValueObject('a1b2c3d4e5f6078')).toThrow();
  });

  it('throws for a keyId longer than 16 characters', () => {
    expect(() => new ApiKeyIdValueObject('a1b2c3d4e5f607891')).toThrow();
  });

  it('throws for a keyId containing uppercase-hex characters', () => {
    expect(() => new ApiKeyIdValueObject('A1B2C3D4E5F60789')).toThrow();
  });

  it('throws for a keyId containing non-hex characters', () => {
    expect(() => new ApiKeyIdValueObject('g1b2c3d4e5f60789')).toThrow();
  });
});
