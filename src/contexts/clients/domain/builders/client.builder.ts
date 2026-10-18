import { Injectable } from '@nestjs/common';
import {
  BaseBuilder,
  DateValueObject,
  FieldIsRequiredException,
  UuidValueObject,
} from '@sisques-labs/nestjs-kit';

import { ClientAggregate } from '@contexts/clients/domain/aggregates/client.aggregate';
import { ApiKeyIdValueObject } from '@contexts/clients/domain/value-objects/api-key-id/api-key-id.value-object';
import { ApiKeySecretHashValueObject } from '@contexts/clients/domain/value-objects/api-key-secret-hash/api-key-secret-hash.value-object';
import { ClientNameValueObject } from '@contexts/clients/domain/value-objects/client-name/client-name.value-object';
import { ClientViewModel } from '@contexts/clients/domain/view-models/client.view-model';

@Injectable()
export class ClientBuilder extends BaseBuilder<
  ClientAggregate,
  ClientViewModel
> {
  private _tenantId!: string;
  private _name!: string;
  private _apiKeyId!: string;
  private _apiKeySecretHash!: string;
  private _apiKeyRotatedAt: Date | null = null;
  private _revokedAt: Date | null = null;

  withTenantId(tenantId: string): this {
    this._tenantId = tenantId;
    return this;
  }

  withName(name: string): this {
    this._name = name;
    return this;
  }

  withApiKeyId(apiKeyId: string): this {
    this._apiKeyId = apiKeyId;
    return this;
  }

  withApiKeySecretHash(apiKeySecretHash: string): this {
    this._apiKeySecretHash = apiKeySecretHash;
    return this;
  }

  withApiKeyRotatedAt(apiKeyRotatedAt: Date | null): this {
    this._apiKeyRotatedAt = apiKeyRotatedAt;
    return this;
  }

  withRevokedAt(revokedAt: Date | null): this {
    this._revokedAt = revokedAt;
    return this;
  }

  public override build(): ClientAggregate {
    this.validate();
    return new ClientAggregate({
      id: new UuidValueObject(this._id),
      tenantId: new UuidValueObject(this._tenantId),
      name: new ClientNameValueObject(this._name),
      apiKeyId: new ApiKeyIdValueObject(this._apiKeyId),
      apiKeySecretHash: new ApiKeySecretHashValueObject(this._apiKeySecretHash),
      apiKeyRotatedAt: this._apiKeyRotatedAt
        ? new DateValueObject(this._apiKeyRotatedAt)
        : null,
      revokedAt: this._revokedAt ? new DateValueObject(this._revokedAt) : null,
      createdAt: new DateValueObject(this._createdAt),
      updatedAt: new DateValueObject(this._updatedAt),
    });
  }

  public override buildViewModel(): ClientViewModel {
    this.validate();
    return new ClientViewModel({
      id: this._id,
      tenantId: this._tenantId,
      name: this._name,
      apiKeyId: this._apiKeyId,
      apiKeyRotatedAt: this._apiKeyRotatedAt,
      revokedAt: this._revokedAt,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    });
  }

  public override validate(): void {
    super.validate();
    if (!this._tenantId) throw new FieldIsRequiredException('tenantId');
    if (!this._name) throw new FieldIsRequiredException('name');
    if (!this._apiKeyId) throw new FieldIsRequiredException('apiKeyId');
    if (!this._apiKeySecretHash)
      throw new FieldIsRequiredException('apiKeySecretHash');
  }
}
