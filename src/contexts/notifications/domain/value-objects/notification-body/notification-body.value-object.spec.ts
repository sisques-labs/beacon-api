import { NotificationBodyValueObject } from '@contexts/notifications/domain/value-objects/notification-body/notification-body.value-object';

describe('NotificationBodyValueObject', () => {
  it('wraps a non-empty body', () => {
    expect(new NotificationBodyValueObject('Message body').value).toBe(
      'Message body',
    );
  });

  it('throws for an empty body', () => {
    expect(() => new NotificationBodyValueObject('')).toThrow();
  });

  it('throws for a body longer than MAX_LENGTH', () => {
    const tooLong = 'a'.repeat(NotificationBodyValueObject.MAX_LENGTH + 1);
    expect(() => new NotificationBodyValueObject(tooLong)).toThrow();
  });
});
