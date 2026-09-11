import { NotificationSourceServiceValueObject } from '@contexts/notifications/domain/value-objects/notification-source-service/notification-source-service.value-object';

describe('NotificationSourceServiceValueObject', () => {
  it('wraps a non-empty source service', () => {
    expect(new NotificationSourceServiceValueObject('gardenia-api').value).toBe(
      'gardenia-api',
    );
  });

  it('throws for an empty source service', () => {
    expect(() => new NotificationSourceServiceValueObject('')).toThrow();
  });

  it('throws for a source service longer than MAX_LENGTH', () => {
    const tooLong = 'a'.repeat(
      NotificationSourceServiceValueObject.MAX_LENGTH + 1,
    );
    expect(() => new NotificationSourceServiceValueObject(tooLong)).toThrow();
  });
});
