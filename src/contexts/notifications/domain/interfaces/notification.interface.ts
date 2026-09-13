import { IBaseAggregate, UuidValueObject } from '@sisques-labs/nestjs-kit';

import { NotificationBodyValueObject } from '@contexts/notifications/domain/value-objects/notification-body/notification-body.value-object';
import { NotificationCancelledAtValueObject } from '@contexts/notifications/domain/value-objects/notification-cancelled-at/notification-cancelled-at.value-object';
import { NotificationChannelValueObject } from '@contexts/notifications/domain/value-objects/notification-channel/notification-channel.value-object';
import { NotificationDedupeKeyValueObject } from '@contexts/notifications/domain/value-objects/notification-dedupe-key/notification-dedupe-key.value-object';
import { NotificationFailureReasonValueObject } from '@contexts/notifications/domain/value-objects/notification-failure-reason/notification-failure-reason.value-object';
import { NotificationReadAtValueObject } from '@contexts/notifications/domain/value-objects/notification-read-at/notification-read-at.value-object';
import { NotificationSentAtValueObject } from '@contexts/notifications/domain/value-objects/notification-sent-at/notification-sent-at.value-object';
import { NotificationSourceServiceValueObject } from '@contexts/notifications/domain/value-objects/notification-source-service/notification-source-service.value-object';
import { NotificationStatusValueObject } from '@contexts/notifications/domain/value-objects/notification-status/notification-status.value-object';
import { NotificationTitleValueObject } from '@contexts/notifications/domain/value-objects/notification-title/notification-title.value-object';

export interface INotification extends IBaseAggregate {
  tenantId: UuidValueObject;
  recipientUserId: UuidValueObject;
  channel: NotificationChannelValueObject;
  status: NotificationStatusValueObject;
  title: NotificationTitleValueObject;
  body: NotificationBodyValueObject;
  sourceService: NotificationSourceServiceValueObject;
  dedupeKey: NotificationDedupeKeyValueObject;
  failureReason: NotificationFailureReasonValueObject | null;
  sentAt: NotificationSentAtValueObject | null;
  readAt: NotificationReadAtValueObject | null;
  cancelledAt: NotificationCancelledAtValueObject | null;
}
