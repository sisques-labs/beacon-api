import { IBaseAggregate, UuidValueObject } from '@sisques-labs/nestjs-kit';

import { EncryptedSecretValueObject } from '@contexts/notifications/domain/value-objects/encrypted-secret/encrypted-secret.value-object';
import { NotificationChannelValueObject } from '@contexts/notifications/domain/value-objects/notification-channel/notification-channel.value-object';

export interface INotificationChannelDestination extends IBaseAggregate {
  tenantId: UuidValueObject;
  channel: NotificationChannelValueObject;
  envelope: EncryptedSecretValueObject;
}
