import { NotificationFailureReasonValueObject } from '@contexts/notifications/domain/value-objects/notification-failure-reason/notification-failure-reason.value-object';

describe('NotificationFailureReasonValueObject', () => {
  it('wraps a non-empty failure reason', () => {
    expect(new NotificationFailureReasonValueObject('SMTP timeout').value).toBe(
      'SMTP timeout',
    );
  });

  it('throws for an empty failure reason', () => {
    expect(() => new NotificationFailureReasonValueObject('')).toThrow();
  });
});
