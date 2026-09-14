import { NotificationDedupeKeyValueObject } from '@contexts/notifications/domain/value-objects/notification-dedupe-key/notification-dedupe-key.value-object';

describe('NotificationDedupeKeyValueObject', () => {
  it('wraps a non-empty dedupe key', () => {
    expect(
      new NotificationDedupeKeyValueObject('gardenia:plant:123:watered').value,
    ).toBe('gardenia:plant:123:watered');
  });

  it('throws for an empty dedupe key', () => {
    expect(() => new NotificationDedupeKeyValueObject('')).toThrow();
  });

  it('throws for a dedupe key longer than MAX_LENGTH', () => {
    const tooLong = 'a'.repeat(NotificationDedupeKeyValueObject.MAX_LENGTH + 1);
    expect(() => new NotificationDedupeKeyValueObject(tooLong)).toThrow();
  });
});
