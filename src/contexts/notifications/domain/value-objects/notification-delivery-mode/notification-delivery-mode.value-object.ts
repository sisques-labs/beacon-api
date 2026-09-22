import { EnumValueObject } from '@sisques-labs/nestjs-kit';

import { NotificationDeliveryModeEnum } from '@contexts/notifications/domain/enums/notification-delivery-mode.enum';

export class NotificationDeliveryModeValueObject extends EnumValueObject<
  typeof NotificationDeliveryModeEnum
> {
  constructor(value: NotificationDeliveryModeEnum) {
    super(value);
  }

  protected get enumObject(): typeof NotificationDeliveryModeEnum {
    return NotificationDeliveryModeEnum as unknown as typeof NotificationDeliveryModeEnum;
  }
}
