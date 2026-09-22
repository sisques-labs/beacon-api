import { NotificationDeliveryModeEnum } from '@contexts/notifications/domain/enums/notification-delivery-mode.enum';
import { NotificationDeliveryModeValueObject } from '@contexts/notifications/domain/value-objects/notification-delivery-mode/notification-delivery-mode.value-object';

describe('NotificationDeliveryModeValueObject', () => {
  it.each([
    NotificationDeliveryModeEnum.DELIVER,
    NotificationDeliveryModeEnum.RECORD_ONLY,
  ])('accepts valid delivery mode %s', (mode) => {
    expect(new NotificationDeliveryModeValueObject(mode).value).toBe(mode);
  });

  it('rejects an unknown delivery mode', () => {
    expect(
      () =>
        new NotificationDeliveryModeValueObject(
          'MAYBE' as NotificationDeliveryModeEnum,
        ),
    ).toThrow();
  });

  it('rejects a URL-shaped string (SSRF D3 — never interpreted as a destination)', () => {
    expect(
      () =>
        new NotificationDeliveryModeValueObject(
          'https://evil.example/x' as NotificationDeliveryModeEnum,
        ),
    ).toThrow();
  });
});
