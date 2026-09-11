import { NotificationChannelEnum } from '@contexts/notifications/domain/enums/notification-channel.enum';
import { NotificationChannelValueObject } from '@contexts/notifications/domain/value-objects/notification-channel/notification-channel.value-object';

describe('NotificationChannelValueObject', () => {
  it.each([
    NotificationChannelEnum.EMAIL,
    NotificationChannelEnum.PUSH,
    NotificationChannelEnum.DISCORD,
  ])('accepts valid channel %s', (channel) => {
    expect(new NotificationChannelValueObject(channel).value).toBe(channel);
  });

  it('rejects an unknown channel', () => {
    expect(
      () =>
        new NotificationChannelValueObject('SMS' as NotificationChannelEnum),
    ).toThrow();
  });
});
