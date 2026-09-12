import { UuidValueObject } from '@sisques-labs/nestjs-kit';

import { NotificationChannelEnum } from '@contexts/notifications/domain/enums/notification-channel.enum';
import { NotificationBodyValueObject } from '@contexts/notifications/domain/value-objects/notification-body/notification-body.value-object';
import { NotificationChannelValueObject } from '@contexts/notifications/domain/value-objects/notification-channel/notification-channel.value-object';
import { NotificationDedupeKeyValueObject } from '@contexts/notifications/domain/value-objects/notification-dedupe-key/notification-dedupe-key.value-object';
import { NotificationSourceServiceValueObject } from '@contexts/notifications/domain/value-objects/notification-source-service/notification-source-service.value-object';
import { NotificationTitleValueObject } from '@contexts/notifications/domain/value-objects/notification-title/notification-title.value-object';

export interface CreateNotificationCommandInput {
  tenantId: string;
  recipientUserId: string;
  channel: NotificationChannelEnum;
  title: string;
  body: string;
  sourceService: string;
  dedupeKey: string;
}

export class CreateNotificationCommand {
  public readonly tenantId: UuidValueObject;
  public readonly recipientUserId: UuidValueObject;
  public readonly channel: NotificationChannelValueObject;
  public readonly title: NotificationTitleValueObject;
  public readonly body: NotificationBodyValueObject;
  public readonly sourceService: NotificationSourceServiceValueObject;
  public readonly dedupeKey: NotificationDedupeKeyValueObject;

  constructor(input: CreateNotificationCommandInput) {
    this.tenantId = new UuidValueObject(input.tenantId);
    this.recipientUserId = new UuidValueObject(input.recipientUserId);
    this.channel = new NotificationChannelValueObject(input.channel);
    this.title = new NotificationTitleValueObject(input.title);
    this.body = new NotificationBodyValueObject(input.body);
    this.sourceService = new NotificationSourceServiceValueObject(
      input.sourceService,
    );
    this.dedupeKey = new NotificationDedupeKeyValueObject(input.dedupeKey);
  }
}
