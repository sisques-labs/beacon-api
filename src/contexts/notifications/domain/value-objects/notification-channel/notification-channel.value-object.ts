import { EnumValueObject } from '@sisques-labs/nestjs-kit';

import { NotificationChannelEnum } from '@contexts/notifications/domain/enums/notification-channel.enum';

export class NotificationChannelValueObject extends EnumValueObject<
  typeof NotificationChannelEnum
> {
  constructor(value: NotificationChannelEnum) {
    super(value);
  }

  protected get enumObject(): typeof NotificationChannelEnum {
    return NotificationChannelEnum as unknown as typeof NotificationChannelEnum;
  }
}
