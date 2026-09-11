import { vi } from 'vitest';

import { NotificationChannelEnum } from '@contexts/notifications/domain/enums/notification-channel.enum';
import { NotificationStatusEnum } from '@contexts/notifications/domain/enums/notification-status.enum';

const registerEnumType = vi.fn();

vi.mock('@nestjs/graphql', () => ({
  registerEnumType: (...args: unknown[]) => registerEnumType(...args),
}));

describe('notification-registered-enums.graphql', () => {
  it('registers NotificationChannelEnum and NotificationStatusEnum', async () => {
    await import('./notification-registered-enums.graphql');

    expect(registerEnumType).toHaveBeenCalledWith(
      NotificationChannelEnum,
      expect.objectContaining({ name: 'NotificationChannelEnum' }),
    );
    expect(registerEnumType).toHaveBeenCalledWith(
      NotificationStatusEnum,
      expect.objectContaining({ name: 'NotificationStatusEnum' }),
    );
  });
});
