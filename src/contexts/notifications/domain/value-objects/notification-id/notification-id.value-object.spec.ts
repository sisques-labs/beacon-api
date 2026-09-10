import { NotificationIdValueObject } from '@contexts/notifications/domain/value-objects/notification-id/notification-id.value-object';

describe('NotificationIdValueObject', () => {
  it('accepts a valid UUID', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000';
    expect(new NotificationIdValueObject(id).value).toBe(id);
  });

  it('rejects an invalid UUID', () => {
    expect(() => new NotificationIdValueObject('not-a-uuid')).toThrow();
  });
});
