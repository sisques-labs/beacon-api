import {
  DateValueObject,
  IBaseAggregate,
  UuidValueObject,
} from '@sisques-labs/nestjs-kit';

import { ApiKeyIdValueObject } from '@contexts/clients/domain/value-objects/api-key-id/api-key-id.value-object';
import { ApiKeySecretHashValueObject } from '@contexts/clients/domain/value-objects/api-key-secret-hash/api-key-secret-hash.value-object';
import { ClientNameValueObject } from '@contexts/clients/domain/value-objects/client-name/client-name.value-object';

export interface IClient extends IBaseAggregate {
  tenantId: UuidValueObject;
  name: ClientNameValueObject;
  apiKeyId: ApiKeyIdValueObject;
  apiKeySecretHash: ApiKeySecretHashValueObject;
  apiKeyRotatedAt: DateValueObject | null;
  revokedAt: DateValueObject | null;
}
