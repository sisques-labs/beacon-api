import { BaseAggregate, UuidValueObject } from '@sisques-labs/nestjs-kit';

import { INotificationChannelDestinationEventData } from '@contexts/notifications/domain/events/interfaces/notification-channel-destination-event-data.interface';
import { NotificationChannelDestinationRegisteredEvent } from '@contexts/notifications/domain/events/notification-channel-destination-registered/notification-channel-destination-registered.event';
import { NotificationChannelDestinationRotatedEvent } from '@contexts/notifications/domain/events/notification-channel-destination-rotated/notification-channel-destination-rotated.event';
import { INotificationChannelDestination } from '@contexts/notifications/domain/interfaces/notification-channel-destination.interface';
import { INotificationChannelDestinationPrimitives } from '@contexts/notifications/domain/primitives/notification-channel-destination.primitives';
import { EncryptedSecretValueObject } from '@contexts/notifications/domain/value-objects/encrypted-secret/encrypted-secret.value-object';
import { NotificationChannelValueObject } from '@contexts/notifications/domain/value-objects/notification-channel/notification-channel.value-object';

export class NotificationChannelDestinationAggregate extends BaseAggregate {
  private readonly _tenantId: UuidValueObject;
  private readonly _channel: NotificationChannelValueObject;
  private _envelope: EncryptedSecretValueObject;

  constructor(props: INotificationChannelDestination) {
    super(props.id, props.createdAt, props.updatedAt);
    this._tenantId = props.tenantId;
    this._channel = props.channel;
    this._envelope = props.envelope;
  }

  public register(): void {
    this.apply(
      new NotificationChannelDestinationRegisteredEvent(
        this.generateEventMetadata(
          NotificationChannelDestinationRegisteredEvent,
        ),
        this.toEventData(),
      ),
    );
  }

  public rotate(envelope: EncryptedSecretValueObject): void {
    this._envelope = envelope;
    this.touch();
    this.apply(
      new NotificationChannelDestinationRotatedEvent(
        this.generateEventMetadata(NotificationChannelDestinationRotatedEvent),
        this.toEventData(),
      ),
    );
  }

  private toEventData(): INotificationChannelDestinationEventData {
    return {
      id: this.id.value,
      tenantId: this._tenantId.value,
      channel: this._channel.value,
      createdAt: this.createdAt.value,
      updatedAt: this.updatedAt.value,
    };
  }

  /**
   * Persistence-only shape (Phase 5 mapper). MUST NEVER be used to build a
   * domain event payload — `register()`/`rotate()` above always call
   * `toEventData()`, never this method, because the envelope must not leave
   * the database via Kafka/EventStore (D9).
   */
  public toPrimitives(): INotificationChannelDestinationPrimitives {
    return {
      id: this.id.value,
      tenantId: this._tenantId.value,
      channel: this._channel.value,
      envelope: this._envelope.value,
      createdAt: this.createdAt.value,
      updatedAt: this.updatedAt.value,
    };
  }

  get tenantId(): UuidValueObject {
    return this._tenantId;
  }

  get channel(): NotificationChannelValueObject {
    return this._channel;
  }

  get envelope(): EncryptedSecretValueObject {
    return this._envelope;
  }
}
