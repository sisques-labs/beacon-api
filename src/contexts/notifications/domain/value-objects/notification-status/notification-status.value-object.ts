import { EnumValueObject } from '@sisques-labs/nestjs-kit';

import { NotificationStatusEnum } from '@contexts/notifications/domain/enums/notification-status.enum';

export class NotificationStatusValueObject extends EnumValueObject<
  typeof NotificationStatusEnum
> {
  constructor(value: NotificationStatusEnum) {
    super(value);
  }

  protected get enumObject(): typeof NotificationStatusEnum {
    return NotificationStatusEnum as unknown as typeof NotificationStatusEnum;
  }
}
