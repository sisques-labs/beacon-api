import { vi } from 'vitest';

import { NotificationChannelEnum } from '@contexts/notifications/domain/enums/notification-channel.enum';
import { NotificationDeliveryModeEnum } from '@contexts/notifications/domain/enums/notification-delivery-mode.enum';
import { NotificationStatusEnum } from '@contexts/notifications/domain/enums/notification-status.enum';
import { NotificationQueryableField } from '@contexts/notifications/transport/graphql/enums/notification-queryable-field.enum';

const registerEnumType = vi.fn();

vi.mock('@nestjs/graphql', () => ({
  registerEnumType: (...args: unknown[]) => registerEnumType(...args),
}));

describe('notification-registered-enums.graphql', () => {
  it('registers NotificationChannelEnum, NotificationStatusEnum, and NotificationDeliveryModeEnum', async () => {
    await import('./notification-registered-enums.graphql');

    expect(registerEnumType).toHaveBeenCalledWith(
      NotificationChannelEnum,
      expect.objectContaining({ name: 'NotificationChannelEnum' }),
    );
    expect(registerEnumType).toHaveBeenCalledWith(
      NotificationStatusEnum,
      expect.objectContaining({ name: 'NotificationStatusEnum' }),
    );
    expect(registerEnumType).toHaveBeenCalledWith(
      NotificationDeliveryModeEnum,
      expect.objectContaining({ name: 'NotificationDeliveryModeEnum' }),
    );
  });

  it('registers NotificationDeliveryModeEnum', async () => {
    await import('./notification-registered-enums.graphql');

    expect(registerEnumType).toHaveBeenCalledWith(
      NotificationDeliveryModeEnum,
      expect.objectContaining({ name: 'NotificationDeliveryModeEnum' }),
    );
  });

  it('registers NotificationQueryableFieldEnum', async () => {
    await import('./notification-registered-enums.graphql');

    expect(registerEnumType).toHaveBeenCalledWith(
      NotificationQueryableField,
      expect.objectContaining({ name: 'NotificationQueryableFieldEnum' }),
    );
  });
});
