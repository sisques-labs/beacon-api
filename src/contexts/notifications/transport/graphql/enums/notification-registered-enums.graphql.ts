import { registerEnumType } from '@nestjs/graphql';

import { NotificationChannelEnum } from '@contexts/notifications/domain/enums/notification-channel.enum';
import { NotificationDeliveryModeEnum } from '@contexts/notifications/domain/enums/notification-delivery-mode.enum';
import { NotificationStatusEnum } from '@contexts/notifications/domain/enums/notification-status.enum';
import { NotificationQueryableField } from '@contexts/notifications/transport/graphql/enums/notification-queryable-field.enum';

const registeredNotificationEnums = [
  {
    enum: NotificationChannelEnum,
    name: 'NotificationChannelEnum',
    description: 'The delivery channel for a notification',
  },
  {
    enum: NotificationStatusEnum,
    name: 'NotificationStatusEnum',
    description: 'The current status of a notification',
  },
  {
    enum: NotificationDeliveryModeEnum,
    name: 'NotificationDeliveryModeEnum',
    description:
      'Whether a notification is actually delivered or only recorded (RECORD_ONLY skips outbound delivery)',
  },
  {
    enum: NotificationQueryableField,
    name: 'NotificationQueryableFieldEnum',
    description:
      'The whitelisted set of Notification fields that may be filtered/sorted via findByCriteria',
  },
];

for (const {
  enum: enumType,
  name,
  description,
} of registeredNotificationEnums) {
  registerEnumType(enumType, { name, description });
}
