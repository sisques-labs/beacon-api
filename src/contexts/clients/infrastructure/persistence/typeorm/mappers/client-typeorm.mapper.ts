import { Injectable } from '@nestjs/common';
import { BaseTypeOrmMapper } from '@sisques-labs/nestjs-kit/typeorm';

import { ClientAggregate } from '@contexts/clients/domain/aggregates/client.aggregate';
import { ClientBuilder } from '@contexts/clients/domain/builders/client.builder';
import { ClientViewModel } from '@contexts/clients/domain/view-models/client.view-model';
import { ClientEntity } from '@contexts/clients/infrastructure/persistence/typeorm/entities/client.entity';

@Injectable()
export class ClientTypeormMapper extends BaseTypeOrmMapper<
  ClientAggregate,
  ClientEntity
> {
  toAggregate(entity: ClientEntity): ClientAggregate {
    return this.buildFrom(entity).build();
  }

  toEntity(aggregate: ClientAggregate): ClientEntity {
    const primitives = aggregate.toPrimitives();
    const entity = new ClientEntity();

    entity.id = primitives.id;
    entity.tenantId = primitives.tenantId;
    entity.name = primitives.name;
    entity.apiKeyId = primitives.apiKeyId;
    entity.apiKeySecretHash = primitives.apiKeySecretHash;
    entity.apiKeyRotatedAt = primitives.apiKeyRotatedAt;
    entity.revokedAt = primitives.revokedAt;
    entity.createdAt = this.normalizeDate(primitives.createdAt);
    entity.updatedAt = this.normalizeDate(primitives.updatedAt);

    return entity;
  }

  /**
   * Built directly from the entity's metadata columns, never through the
   * builder's `buildViewModel()`. The future read repository (D17, mirrors
   * D10) never selects `apiKeySecretHash`, so `entity.apiKeySecretHash` may
   * be `undefined` here — and the builder's shared `validate()` requires a
   * non-empty hash for every build path. Constructing the view model
   * directly keeps that requirement honest for the write side while letting
   * the read side never touch the secret column at all.
   */
  toViewModel(entity: ClientEntity): ClientViewModel {
    return new ClientViewModel({
      id: entity.id,
      tenantId: entity.tenantId,
      name: entity.name,
      apiKeyId: entity.apiKeyId,
      apiKeyRotatedAt: entity.apiKeyRotatedAt
        ? this.normalizeDate(entity.apiKeyRotatedAt)
        : null,
      revokedAt: entity.revokedAt ? this.normalizeDate(entity.revokedAt) : null,
      createdAt: this.normalizeDate(entity.createdAt),
      updatedAt: this.normalizeDate(entity.updatedAt),
    });
  }

  private buildFrom(entity: ClientEntity): ClientBuilder {
    return new ClientBuilder()
      .withId(entity.id)
      .withTenantId(entity.tenantId)
      .withName(entity.name)
      .withApiKeyId(entity.apiKeyId)
      .withApiKeySecretHash(entity.apiKeySecretHash)
      .withApiKeyRotatedAt(entity.apiKeyRotatedAt)
      .withRevokedAt(entity.revokedAt)
      .withCreatedAt(this.normalizeDate(entity.createdAt))
      .withUpdatedAt(this.normalizeDate(entity.updatedAt));
  }
}
