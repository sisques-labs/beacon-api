import { UuidValueObject } from '@sisques-labs/nestjs-kit';
import { NotificationChannelEnum } from '@contexts/notifications/domain/enums/notification-channel.enum';
import { NotificationDeliveryModeEnum } from '@contexts/notifications/domain/enums/notification-delivery-mode.enum';
import { NotificationBodyValueObject } from '@contexts/notifications/domain/value-objects/notification-body/notification-body.value-object';
import { NotificationChannelValueObject } from '@contexts/notifications/domain/value-objects/notification-channel/notification-channel.value-object';
import { NotificationDedupeKeyValueObject } from '@contexts/notifications/domain/value-objects/notification-dedupe-key/notification-dedupe-key.value-object';
import { NotificationDeliveryModeValueObject } from '@contexts/notifications/domain/value-objects/notification-delivery-mode/notification-delivery-mode.value-object';
import { NotificationSourceServiceValueObject } from '@contexts/notifications/domain/value-objects/notification-source-service/notification-source-service.value-object';
import { NotificationTitleValueObject } from '@contexts/notifications/domain/value-objects/notification-title/notification-title.value-object';
import { INotificationPrimitives } from '@contexts/notifications/domain/primitives/notification.primitives';

export type CreateNotificationCommandInput = Pick<
  INotificationPrimitives,
  | 'tenantId'
  | 'recipientUserId'
  | 'channel'
  | 'title'
  | 'body'
  | 'sourceService'
  | 'dedupeKey'
> & { deliveryMode?: string };

export class CreateNotificationCommand {
  public readonly tenantId: UuidValueObject;
  public readonly recipientUserId: UuidValueObject;
  public readonly channel: NotificationChannelValueObject;
  public readonly title: NotificationTitleValueObject;
  public readonly body: NotificationBodyValueObject;
  public readonly sourceService: NotificationSourceServiceValueObject;
  public readonly dedupeKey: NotificationDedupeKeyValueObject;
  public readonly deliveryMode: NotificationDeliveryModeValueObject;

  constructor(input: CreateNotificationCommandInput) {
    this.tenantId = new UuidValueObject(input.tenantId);
    this.recipientUserId = new UuidValueObject(input.recipientUserId);
    this.channel = new NotificationChannelValueObject(
      input.channel as NotificationChannelEnum,
    );
    this.title = new NotificationTitleValueObject(input.title);
    this.body = new NotificationBodyValueObject(input.body);
    this.sourceService = new NotificationSourceServiceValueObject(
      input.sourceService,
    );
    this.dedupeKey = new NotificationDedupeKeyValueObject(input.dedupeKey);
    this.deliveryMode = new NotificationDeliveryModeValueObject(
      (input.deliveryMode ??
        NotificationDeliveryModeEnum.DELIVER) as NotificationDeliveryModeEnum,
    );
  }
}
