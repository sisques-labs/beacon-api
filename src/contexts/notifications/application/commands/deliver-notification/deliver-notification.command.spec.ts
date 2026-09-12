import { DeliverNotificationCommand } from '@contexts/notifications/application/commands/deliver-notification/deliver-notification.command';

const VALID_INPUT = {
  notificationId: '11111111-1111-4111-8111-111111111111',
};

describe('DeliverNotificationCommand', () => {
  it('wraps notificationId in a value object', () => {
    const command = new DeliverNotificationCommand(VALID_INPUT);

    expect(command.notificationId.value).toBe(VALID_INPUT.notificationId);
  });

  it('throws when notificationId is not a valid UUID', () => {
    expect(
      () => new DeliverNotificationCommand({ notificationId: 'not-a-uuid' }),
    ).toThrow();
  });
});
