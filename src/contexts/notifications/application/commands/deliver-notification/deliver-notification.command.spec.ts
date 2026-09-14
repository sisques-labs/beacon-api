import { DeliverNotificationCommand } from '@contexts/notifications/application/commands/deliver-notification/deliver-notification.command';

const VALID_INPUT = {
  notificationId: '11111111-1111-4111-8111-111111111111',
  isFinalAttempt: false,
};

describe('DeliverNotificationCommand', () => {
  it('wraps notificationId in a value object', () => {
    const command = new DeliverNotificationCommand(VALID_INPUT);

    expect(command.notificationId.value).toBe(VALID_INPUT.notificationId);
  });

  it('throws when notificationId is not a valid UUID', () => {
    expect(
      () =>
        new DeliverNotificationCommand({
          notificationId: 'not-a-uuid',
          isFinalAttempt: false,
        }),
    ).toThrow();
  });

  it('wraps isFinalAttempt=false in a value object', () => {
    const command = new DeliverNotificationCommand(VALID_INPUT);

    expect(command.isFinalAttempt.value).toBe(false);
  });

  it('wraps isFinalAttempt=true in a value object', () => {
    const command = new DeliverNotificationCommand({
      ...VALID_INPUT,
      isFinalAttempt: true,
    });

    expect(command.isFinalAttempt.value).toBe(true);
  });
});
