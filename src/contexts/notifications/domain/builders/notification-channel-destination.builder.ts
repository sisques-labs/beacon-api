import { Injectable } from '@nestjs/common';
import {
  BaseBuilder,
  DateValueObject,
  FieldIsRequiredException,
  UuidValueObject,
} from '@sisques-labs/nestjs-kit';

import { NotificationChannelDestinationAggregate } from '@contexts/notifications/domain/aggregates/notification-channel-destination.aggregate';
import { NotificationChannelEnum } from '@contexts/notifications/domain/enums/notification-channel.enum';
import { EncryptedSecretValueObject } from '@contexts/notifications/domain/value-objects/encrypted-secret/encrypted-secret.value-object';
import { NotificationChannelValueObject } from '@contexts/notifications/domain/value-objects/notification-channel/notification-channel.value-object';
import { NotificationChannelDestinationViewModel } from '@contexts/notifications/domain/view-models/notification-channel-destination.view-model';

@Injectable()
export class NotificationChannelDestinationBuilder extends BaseBuilder<
  NotificationChannelDestinationAggregate,
  NotificationChannelDestinationViewModel
> {
  private _tenantId!: string;
  private _channel!: string;
  private _envelope!: string;

  withTenantId(tenantId: string): this {
    this._tenantId = tenantId;
    return this;
  }

  withChannel(channel: string): this {
    this._channel = channel;
    return this;
  }

  withEnvelope(envelope: string): this {
    this._envelope = envelope;
    return this;
  }

  public override build(): NotificationChannelDestinationAggregate {
    this.validate();
    return new NotificationChannelDestinationAggregate({
      id: new UuidValueObject(this._id),
      tenantId: new UuidValueObject(this._tenantId),
      channel: new NotificationChannelValueObject(
        this._channel as NotificationChannelEnum,
      ),
      envelope: new EncryptedSecretValueObject(this._envelope),
      createdAt: new DateValueObject(this._createdAt),
      updatedAt: new DateValueObject(this._updatedAt),
    });
  }

  public override buildViewModel(): NotificationChannelDestinationViewModel {
    this.validate();
    return new NotificationChannelDestinationViewModel({
      id: this._id,
      tenantId: this._tenantId,
      channel: this._channel,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    });
  }

  public override validate(): void {
    super.validate();
    if (!this._tenantId) throw new FieldIsRequiredException('tenantId');
    if (!this._channel) throw new FieldIsRequiredException('channel');
    if (!this._envelope) throw new FieldIsRequiredException('envelope');
  }
}
