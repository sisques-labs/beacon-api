import { CreateNotificationCommand } from '@contexts/notifications/application/commands/create-notification/create-notification.command';
import { NotificationChannelEnum } from '@contexts/notifications/domain/enums/notification-channel.enum';

const VALID_INPUT = {
  tenantId: '11111111-1111-4111-8111-111111111111',
  recipientUserId: '22222222-2222-4222-8222-222222222222',
  channel: NotificationChannelEnum.DISCORD,
  title: 'Plant watered',
  body: 'Your plant was watered successfully.',
  sourceService: 'gardenia-api',
  dedupeKey: 'gardenia:plant:1:watered',
};

describe('CreateNotificationCommand', () => {
  it('wraps every primitive field in its value object', () => {
    const command = new CreateNotificationCommand(VALID_INPUT);

    expect(command.tenantId.value).toBe(VALID_INPUT.tenantId);
    expect(command.recipientUserId.value).toBe(VALID_INPUT.recipientUserId);
    expect(command.channel.value).toBe(NotificationChannelEnum.DISCORD);
    expect(command.title.value).toBe(VALID_INPUT.title);
    expect(command.body.value).toBe(VALID_INPUT.body);
    expect(command.sourceService.value).toBe(VALID_INPUT.sourceService);
    expect(command.dedupeKey.value).toBe(VALID_INPUT.dedupeKey);
  });

  it('throws when a required field is invalid', () => {
    expect(
      () => new CreateNotificationCommand({ ...VALID_INPUT, tenantId: '' }),
    ).toThrow();
  });
});
