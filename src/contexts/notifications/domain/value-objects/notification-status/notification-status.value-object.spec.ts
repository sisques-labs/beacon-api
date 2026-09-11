import { NotificationStatusEnum } from '@contexts/notifications/domain/enums/notification-status.enum';
import { NotificationStatusValueObject } from '@contexts/notifications/domain/value-objects/notification-status/notification-status.value-object';

describe('NotificationStatusValueObject', () => {
  it.each([
    NotificationStatusEnum.PENDING,
    NotificationStatusEnum.SENT,
    NotificationStatusEnum.FAILED,
    NotificationStatusEnum.CANCELLED,
    NotificationStatusEnum.READ,
  ])('accepts valid status %s', (status) => {
    expect(new NotificationStatusValueObject(status).value).toBe(status);
  });

  it('rejects an unknown status', () => {
    expect(
      () =>
        new NotificationStatusValueObject(
          'DELIVERED' as NotificationStatusEnum,
        ),
    ).toThrow();
  });
});
