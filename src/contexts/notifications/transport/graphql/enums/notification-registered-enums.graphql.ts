import { registerEnumType } from '@nestjs/graphql';

import { NotificationChannelEnum } from '@contexts/notifications/domain/enums/notification-channel.enum';
import { NotificationStatusEnum } from '@contexts/notifications/domain/enums/notification-status.enum';

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
];

for (const {
  enum: enumType,
  name,
  description,
} of registeredNotificationEnums) {
  registerEnumType(enumType, { name, description });
}
