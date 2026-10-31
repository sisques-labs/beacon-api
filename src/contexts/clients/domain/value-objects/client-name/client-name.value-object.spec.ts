import { ClientNameValueObject } from '@contexts/clients/domain/value-objects/client-name/client-name.value-object';

describe('ClientNameValueObject', () => {
  it('wraps a non-empty name', () => {
    expect(new ClientNameValueObject('Acme Corp').value).toBe('Acme Corp');
  });

  it('throws for an empty name', () => {
    expect(() => new ClientNameValueObject('')).toThrow();
  });

  it('throws for a name longer than MAX_LENGTH', () => {
    const tooLong = 'a'.repeat(ClientNameValueObject.MAX_LENGTH + 1);
    expect(() => new ClientNameValueObject(tooLong)).toThrow();
  });
});
