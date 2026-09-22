import { InputType } from '@nestjs/graphql';
import { createSortInput } from '@sisques-labs/nestjs-kit/graphql';

import { NotificationQueryableField } from '@contexts/notifications/transport/graphql/enums/notification-queryable-field.enum';

@InputType('NotificationSortInput')
export class NotificationSortInput extends createSortInput(
  NotificationQueryableField,
  'Notification',
) {}
