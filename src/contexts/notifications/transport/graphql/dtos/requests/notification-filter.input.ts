import { InputType } from '@nestjs/graphql';
import { createFilterInput } from '@sisques-labs/nestjs-kit/graphql';

import { NotificationQueryableField } from '@contexts/notifications/transport/graphql/enums/notification-queryable-field.enum';

@InputType('NotificationFilterInput')
export class NotificationFilterInput extends createFilterInput(
  NotificationQueryableField,
  'Notification',
) {}
