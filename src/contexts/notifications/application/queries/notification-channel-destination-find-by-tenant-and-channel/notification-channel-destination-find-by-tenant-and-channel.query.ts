import { UuidValueObject } from '@sisques-labs/nestjs-kit';

import { NotificationChannelEnum } from '@contexts/notifications/domain/enums/notification-channel.enum';
import { NotificationChannelValueObject } from '@contexts/notifications/domain/value-objects/notification-channel/notification-channel.value-object';

export interface NotificationChannelDestinationFindByTenantAndChannelQueryInput {
  tenantId: string;
  channel: string;
}

export class NotificationChannelDestinationFindByTenantAndChannelQuery {
  public readonly tenantId: UuidValueObject;
  public readonly channel: NotificationChannelValueObject;

  constructor(
    input: NotificationChannelDestinationFindByTenantAndChannelQueryInput,
  ) {
    this.tenantId = new UuidValueObject(input.tenantId);
    this.channel = new NotificationChannelValueObject(
      input.channel as NotificationChannelEnum,
    );
  }
}
