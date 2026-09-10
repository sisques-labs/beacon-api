import { BaseAggregate, UuidValueObject } from '@sisques-labs/nestjs-kit';

import { NotificationStatusEnum } from '@contexts/notifications/domain/enums/notification-status.enum';
import { NotificationCancelledEvent } from '@contexts/notifications/domain/events/notification-cancelled/notification-cancelled.event';
import { NotificationCreatedEvent } from '@contexts/notifications/domain/events/notification-created/notification-created.event';
import { NotificationFailedEvent } from '@contexts/notifications/domain/events/notification-failed/notification-failed.event';
import { NotificationReadEvent } from '@contexts/notifications/domain/events/notification-read/notification-read.event';
import { NotificationSentEvent } from '@contexts/notifications/domain/events/notification-sent/notification-sent.event';
import { InvalidNotificationStatusTransitionException } from '@contexts/notifications/domain/exceptions/invalid-notification-status-transition.exception';
import { INotification } from '@contexts/notifications/domain/interfaces/notification.interface';
import { INotificationPrimitives } from '@contexts/notifications/domain/primitives/notification.primitives';
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

export class NotificationAggregate extends BaseAggregate {
  private readonly _tenantId: UuidValueObject;
  private readonly _recipientUserId: UuidValueObject;
  private readonly _channel: NotificationChannelValueObject;
  private _status: NotificationStatusValueObject;
  private readonly _title: NotificationTitleValueObject;
  private readonly _body: NotificationBodyValueObject;
  private readonly _sourceService: NotificationSourceServiceValueObject;
  private readonly _dedupeKey: NotificationDedupeKeyValueObject;
  private _failureReason: NotificationFailureReasonValueObject | null;
  private _sentAt: NotificationSentAtValueObject | null;
  private _readAt: NotificationReadAtValueObject | null;
  private _cancelledAt: NotificationCancelledAtValueObject | null;

  constructor(props: INotification) {
    super(props.id, props.createdAt, props.updatedAt);
    this._tenantId = props.tenantId;
    this._recipientUserId = props.recipientUserId;
    this._channel = props.channel;
    this._status = props.status;
    this._title = props.title;
    this._body = props.body;
    this._sourceService = props.sourceService;
    this._dedupeKey = props.dedupeKey;
    this._failureReason = props.failureReason;
    this._sentAt = props.sentAt;
    this._readAt = props.readAt;
    this._cancelledAt = props.cancelledAt;
  }

  public create(): void {
    this.apply(
      new NotificationCreatedEvent(
        this.generateEventMetadata(NotificationCreatedEvent),
        this.toPrimitives(),
      ),
    );
  }

  public sent(): void {
    this.assertTransition(
      NotificationStatusEnum.PENDING,
      NotificationStatusEnum.SENT,
    );
    this._status = new NotificationStatusValueObject(
      NotificationStatusEnum.SENT,
    );
    this._sentAt = new NotificationSentAtValueObject(new Date());
    this.touch();
    this.apply(
      new NotificationSentEvent(
        this.generateEventMetadata(NotificationSentEvent),
        this.toPrimitives(),
      ),
    );
  }

  public fail(reason: string): void {
    this.assertTransition(
      NotificationStatusEnum.PENDING,
      NotificationStatusEnum.FAILED,
    );
    this._status = new NotificationStatusValueObject(
      NotificationStatusEnum.FAILED,
    );
    this._failureReason = new NotificationFailureReasonValueObject(reason);
    this.touch();
    this.apply(
      new NotificationFailedEvent(
        this.generateEventMetadata(NotificationFailedEvent),
        this.toPrimitives(),
      ),
    );
  }

  public cancel(): void {
    this.assertTransition(
      NotificationStatusEnum.PENDING,
      NotificationStatusEnum.CANCELLED,
    );
    this._status = new NotificationStatusValueObject(
      NotificationStatusEnum.CANCELLED,
    );
    this._cancelledAt = new NotificationCancelledAtValueObject(new Date());
    this.touch();
    this.apply(
      new NotificationCancelledEvent(
        this.generateEventMetadata(NotificationCancelledEvent),
        this.toPrimitives(),
      ),
    );
  }

  public read(): void {
    this.assertTransition(
      NotificationStatusEnum.SENT,
      NotificationStatusEnum.READ,
    );
    this._status = new NotificationStatusValueObject(
      NotificationStatusEnum.READ,
    );
    this._readAt = new NotificationReadAtValueObject(new Date());
    this.touch();
    this.apply(
      new NotificationReadEvent(
        this.generateEventMetadata(NotificationReadEvent),
        this.toPrimitives(),
      ),
    );
  }

  public toPrimitives(): INotificationPrimitives {
    return {
      id: this.id.value,
      tenantId: this._tenantId.value,
      recipientUserId: this._recipientUserId.value,
      channel: this._channel.value,
      status: this._status.value,
      title: this._title.value,
      body: this._body.value,
      sourceService: this._sourceService.value,
      dedupeKey: this._dedupeKey.value,
      failureReason: this._failureReason?.value ?? null,
      sentAt: this._sentAt?.value ?? null,
      readAt: this._readAt?.value ?? null,
      cancelledAt: this._cancelledAt?.value ?? null,
      createdAt: this.createdAt.value,
      updatedAt: this.updatedAt.value,
    };
  }

  private assertTransition(
    expected: NotificationStatusEnum,
    target: NotificationStatusEnum,
  ): void {
    if (this._status.value !== expected) {
      throw new InvalidNotificationStatusTransitionException(
        this._status.value,
        target,
      );
    }
  }

  override get id(): NotificationIdValueObject {
    return this._id as NotificationIdValueObject;
  }

  get tenantId(): UuidValueObject {
    return this._tenantId;
  }

  get recipientUserId(): UuidValueObject {
    return this._recipientUserId;
  }

  get channel(): NotificationChannelValueObject {
    return this._channel;
  }

  get status(): NotificationStatusValueObject {
    return this._status;
  }

  get title(): NotificationTitleValueObject {
    return this._title;
  }

  get body(): NotificationBodyValueObject {
    return this._body;
  }

  get sourceService(): NotificationSourceServiceValueObject {
    return this._sourceService;
  }

  get dedupeKey(): NotificationDedupeKeyValueObject {
    return this._dedupeKey;
  }

  get failureReason(): NotificationFailureReasonValueObject | null {
    return this._failureReason;
  }

  get sentAt(): NotificationSentAtValueObject | null {
    return this._sentAt;
  }

  get readAt(): NotificationReadAtValueObject | null {
    return this._readAt;
  }

  get cancelledAt(): NotificationCancelledAtValueObject | null {
    return this._cancelledAt;
  }
}
