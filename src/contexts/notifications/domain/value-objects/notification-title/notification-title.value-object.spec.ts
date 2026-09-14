import { NotificationTitleValueObject } from '@contexts/notifications/domain/value-objects/notification-title/notification-title.value-object';

describe('NotificationTitleValueObject', () => {
  it('wraps a non-empty title', () => {
    expect(new NotificationTitleValueObject('Hello').value).toBe('Hello');
  });

  it('throws for an empty title', () => {
    expect(() => new NotificationTitleValueObject('')).toThrow();
  });

  it('throws for a title longer than MAX_LENGTH', () => {
    const tooLong = 'a'.repeat(NotificationTitleValueObject.MAX_LENGTH + 1);
    expect(() => new NotificationTitleValueObject(tooLong)).toThrow();
  });
});
