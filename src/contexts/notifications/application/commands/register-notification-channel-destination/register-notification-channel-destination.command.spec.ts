import { RegisterNotificationChannelDestinationCommand } from '@contexts/notifications/application/commands/register-notification-channel-destination/register-notification-channel-destination.command';
import { NotificationChannelEnum } from '@contexts/notifications/domain/enums/notification-channel.enum';
import { UnsupportedDestinationChannelException } from '@contexts/notifications/domain/exceptions/unsupported-destination-channel.exception';
import { InvalidDiscordWebhookUrlException } from '@contexts/notifications/domain/exceptions/invalid-discord-webhook-url.exception';

const VALID_INPUT = {
  tenantId: '11111111-1111-4111-8111-111111111111',
  channel: NotificationChannelEnum.DISCORD,
  webhookUrl: 'https://discord.com/api/webhooks/123456789012345678/aValidToken',
};

describe('RegisterNotificationChannelDestinationCommand', () => {
  it('wraps every primitive field in its value object', () => {
    const command = new RegisterNotificationChannelDestinationCommand(
      VALID_INPUT,
    );

    expect(command.tenantId.value).toBe(VALID_INPUT.tenantId);
    expect(command.channel.value).toBe(NotificationChannelEnum.DISCORD);
    expect(command.webhookUrl.value).toBe(VALID_INPUT.webhookUrl);
  });

  it('throws when tenantId is not a valid UUID', () => {
    expect(
      () =>
        new RegisterNotificationChannelDestinationCommand({
          ...VALID_INPUT,
          tenantId: 'not-a-uuid',
        }),
    ).toThrow();
  });

  it('throws UnsupportedDestinationChannelException for an EMAIL channel, before the URL is ever parsed', () => {
    expect(
      () =>
        new RegisterNotificationChannelDestinationCommand({
          ...VALID_INPUT,
          channel: NotificationChannelEnum.EMAIL,
          webhookUrl: 'not-a-url-at-all',
        }),
    ).toThrow(UnsupportedDestinationChannelException);
  });

  it('throws UnsupportedDestinationChannelException for a PUSH channel', () => {
    expect(
      () =>
        new RegisterNotificationChannelDestinationCommand({
          ...VALID_INPUT,
          channel: NotificationChannelEnum.PUSH,
        }),
    ).toThrow(UnsupportedDestinationChannelException);
  });

  it('throws InvalidDiscordWebhookUrlException for a DISCORD channel with a malformed URL', () => {
    expect(
      () =>
        new RegisterNotificationChannelDestinationCommand({
          ...VALID_INPUT,
          webhookUrl: 'https://evil.com/api/webhooks/123456789012345678/tok',
        }),
    ).toThrow(InvalidDiscordWebhookUrlException);
  });
});
