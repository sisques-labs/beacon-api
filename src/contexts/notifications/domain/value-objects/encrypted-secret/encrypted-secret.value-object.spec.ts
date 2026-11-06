import { inspect } from 'node:util';

import { EncryptedSecretValueObject } from '@contexts/notifications/domain/value-objects/encrypted-secret/encrypted-secret.value-object';

describe('EncryptedSecretValueObject', () => {
  const envelope =
    'v1:AAAAAAAAAAAAAAAA:BBBBBBBBBBBBBBBBBBBBBBBB:c29tZS1jaXBoZXJ0ZXh0';

  it('wraps the envelope and exposes it verbatim via .value', () => {
    expect(new EncryptedSecretValueObject(envelope).value).toBe(envelope);
  });

  it('wraps a different envelope verbatim too (triangulation)', () => {
    const otherEnvelope = 'v2:iiiiiiiiiiiiiiii:tttttttttttttttttttttt:Y2lwaGVy';

    expect(new EncryptedSecretValueObject(otherEnvelope).value).toBe(
      otherEnvelope,
    );
  });

  it('rejects an empty envelope', () => {
    expect(() => new EncryptedSecretValueObject('')).toThrow();
  });

  it('rejects a whitespace-only envelope', () => {
    expect(() => new EncryptedSecretValueObject('   ')).toThrow();
  });

  it('never exposes the envelope via toString()', () => {
    const vo = new EncryptedSecretValueObject(envelope);

    expect(vo.toString()).not.toContain(envelope);
    expect(vo.toString()).not.toContain('c29tZS1jaXBoZXJ0ZXh0');
  });

  it('never exposes the envelope via JSON.stringify()', () => {
    const vo = new EncryptedSecretValueObject(envelope);

    const serialized = JSON.stringify(vo);

    expect(serialized).not.toContain(envelope);
    expect(serialized).not.toContain('c29tZS1jaXBoZXJ0ZXh0');
  });

  it('never exposes the envelope via JSON.stringify() when nested in an object', () => {
    const serialized = JSON.stringify({
      secret: new EncryptedSecretValueObject(envelope),
    });

    expect(serialized).not.toContain(envelope);
    expect(serialized).not.toContain('c29tZS1jaXBoZXJ0ZXh0');
  });

  it('never exposes the envelope via console.log/util.inspect formatting', () => {
    const vo = new EncryptedSecretValueObject(envelope);

    const inspected = inspect(vo);

    expect(inspected).not.toContain(envelope);
    expect(inspected).not.toContain('c29tZS1jaXBoZXJ0ZXh0');
  });
});
