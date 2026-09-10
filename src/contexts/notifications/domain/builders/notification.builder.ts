import { Injectable } from '@nestjs/common';
import {
  BaseBuilder,
  DateValueObject,
  FieldIsRequiredException,
  UuidValueObject,
} from '@sisques-labs/nestjs-kit';

import { NotificationAggregate } from '@contexts/notifications/domain/aggregates/notification.aggregate';
import { NotificationChannelEnum } from '@contexts/notifications/domain/enums/notification-channel.enum';
import { NotificationStatusEnum } from '@contexts/notifications/domain/enums/notification-status.enum';
import { NotificationViewModel } from '@contexts/notifications/domain/view-models/notification.view-model';
import { NotificationBodyValueObject } from '@contexts/notifications/domain/value-objects/notification-body/notification-body.value-object';
import { NotificationCancelledAtValueObject } from '@contexts/notifications/domain/value-objects/notification-cancelled-at/notification-cancelled-at.value-object';
import { NotificationChannelValueObject } from '@contexts/notifications/domain/value-objects/notification-channel/notification-channel.value-object';
import { NotificationDedupeKeyValueObject } from '@contexts/notifications/domain/value-objects/notification-dedupe-key/notification-dedupe-key.value-object';
import { NotificationFailureReasonValueObject } from '@contexts/notifications/domain/value-objects/notification-failure-reason/notification-failure-reason.value-object';
import { NotificationIdValueObject } from '@contexts/notifications/domain/value-objects/notification-id/notification-id.value-object';
import { NotificationReadAtValueObject } from '@contexts/notifications/domain/value-objects/notification-read-at/notification-read-at.value-object';
import { NotificationSentAtValueObject } from '@contexts/notifications/domain/value-objects/notification-sent-at/notification-sent-at.value-object';
import { NotificationSourceServiceValueObject } from '@contexts/notifications/domain/value-objects/notification-source-service/notification-source-service.value-object';
import { NotificationStatusValueObject } from '@contexts/notifications/domain/value-objects/notification-status/notification-status.value-object';
import { NotificationTitleValueObject } from '@contexts/notifications/domain/value-objects/notification-title/notification-title.value-object';

@Injectable()
export class NotificationBuilder extends BaseBuilder<
  NotificationAggregate,
  NotificationViewModel
> {
  private _tenantId!: string;
  private _recipientUserId!: string;
  private _channel!: string;
  private _status: string = NotificationStatusEnum.PENDING;
  private _title!: string;
  private _body!: string;
  private _sourceService!: string;
  private _dedupeKey!: string;
  private _failureReason: string | null = null;
  private _sentAt: Date | null = null;
  private _readAt: Date | null = null;
  private _cancelledAt: Date | null = null;

  withTenantId(tenantId: string): this {
    this._tenantId = tenantId;
    return this;
  }

  withRecipientUserId(recipientUserId: string): this {
    this._recipientUserId = recipientUserId;
    return this;
  }

  withChannel(channel: string): this {
    this._channel = channel;
    return this;
  }

  withStatus(status: string): this {
    this._status = status;
    return this;
  }

  withTitle(title: string): this {
    this._title = title;
    return this;
  }

  withBody(body: string): this {
    this._body = body;
    return this;
  }

  withSourceService(sourceService: string): this {
    this._sourceService = sourceService;
    return this;
  }

  withDedupeKey(dedupeKey: string): this {
    this._dedupeKey = dedupeKey;
    return this;
  }

  withFailureReason(failureReason: string | null): this {
    this._failureReason = failureReason;
    return this;
  }

  withSentAt(sentAt: Date | null): this {
    this._sentAt = sentAt;
    return this;
  }

  withReadAt(readAt: Date | null): this {
    this._readAt = readAt;
    return this;
  }

  withCancelledAt(cancelledAt: Date | null): this {
    this._cancelledAt = cancelledAt;
    return this;
  }

  public override build(): NotificationAggregate {
    this.validate();
    return new NotificationAggregate({
      id: new NotificationIdValueObject(this._id),
      tenantId: new UuidValueObject(this._tenantId),
      recipientUserId: new UuidValueObject(this._recipientUserId),
      channel: new NotificationChannelValueObject(
        this._channel as NotificationChannelEnum,
      ),
      status: new NotificationStatusValueObject(
        this._status as NotificationStatusEnum,
      ),
      title: new NotificationTitleValueObject(this._title),
      body: new NotificationBodyValueObject(this._body),
      sourceService: new NotificationSourceServiceValueObject(
        this._sourceService,
      ),
      dedupeKey: new NotificationDedupeKeyValueObject(this._dedupeKey),
      failureReason:
        this._failureReason !== null
          ? new NotificationFailureReasonValueObject(this._failureReason)
          : null,
      sentAt:
        this._sentAt !== null
          ? new NotificationSentAtValueObject(this._sentAt)
          : null,
      readAt:
        this._readAt !== null
          ? new NotificationReadAtValueObject(this._readAt)
          : null,
      cancelledAt:
        this._cancelledAt !== null
          ? new NotificationCancelledAtValueObject(this._cancelledAt)
          : null,
      createdAt: new DateValueObject(this._createdAt),
      updatedAt: new DateValueObject(this._updatedAt),
    });
  }

  public override buildViewModel(): NotificationViewModel {
    this.validate();
    return new NotificationViewModel({
      id: this._id,
      tenantId: this._tenantId,
      recipientUserId: this._recipientUserId,
      channel: this._channel,
      status: this._status,
      title: this._title,
      body: this._body,
      sourceService: this._sourceService,
      dedupeKey: this._dedupeKey,
      failureReason: this._failureReason,
      sentAt: this._sentAt,
      readAt: this._readAt,
      cancelledAt: this._cancelledAt,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    });
  }

  public override validate(): void {
    super.validate();
    if (!this._tenantId) throw new FieldIsRequiredException('tenantId');
    if (!this._recipientUserId)
      throw new FieldIsRequiredException('recipientUserId');
    if (!this._channel) throw new FieldIsRequiredException('channel');
    if (!this._title) throw new FieldIsRequiredException('title');
    if (!this._body) throw new FieldIsRequiredException('body');
    if (!this._sourceService)
      throw new FieldIsRequiredException('sourceService');
    if (!this._dedupeKey) throw new FieldIsRequiredException('dedupeKey');
  }
}
