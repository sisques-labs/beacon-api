import {
  BaseAggregate,
  DateValueObject,
  UuidValueObject,
} from '@sisques-labs/nestjs-kit';

import { ClientApiKeyRotatedEvent } from '@contexts/clients/domain/events/client-api-key-rotated/client-api-key-rotated.event';
import { ClientCreatedEvent } from '@contexts/clients/domain/events/client-created/client-created.event';
import { ClientRevokedEvent } from '@contexts/clients/domain/events/client-revoked/client-revoked.event';
import { IClientEventData } from '@contexts/clients/domain/events/interfaces/client-event-data.interface';
import { ClientRevokedException } from '@contexts/clients/domain/exceptions/client-revoked.exception';
import { IClient } from '@contexts/clients/domain/interfaces/client.interface';
import { IClientPrimitives } from '@contexts/clients/domain/primitives/client.primitives';
import { ApiKeyIdValueObject } from '@contexts/clients/domain/value-objects/api-key-id/api-key-id.value-object';
import { ApiKeySecretHashValueObject } from '@contexts/clients/domain/value-objects/api-key-secret-hash/api-key-secret-hash.value-object';
import { ClientNameValueObject } from '@contexts/clients/domain/value-objects/client-name/client-name.value-object';

export class ClientAggregate extends BaseAggregate {
  private readonly _tenantId: UuidValueObject;
  private readonly _name: ClientNameValueObject;
  private _apiKeyId: ApiKeyIdValueObject;
  private _apiKeySecretHash: ApiKeySecretHashValueObject;
  private _apiKeyRotatedAt: DateValueObject | null;
  private _revokedAt: DateValueObject | null;

  constructor(props: IClient) {
    super(props.id, props.createdAt, props.updatedAt);
    this._tenantId = props.tenantId;
    this._name = props.name;
    this._apiKeyId = props.apiKeyId;
    this._apiKeySecretHash = props.apiKeySecretHash;
    this._apiKeyRotatedAt = props.apiKeyRotatedAt;
    this._revokedAt = props.revokedAt;
  }

  public create(): void {
    this.apply(
      new ClientCreatedEvent(
        this.generateEventMetadata(ClientCreatedEvent),
        this.toEventData(),
      ),
    );
  }

  public rotateApiKey(
    apiKeyId: ApiKeyIdValueObject,
    apiKeySecretHash: ApiKeySecretHashValueObject,
  ): void {
    this.assertNotRevoked();
    this._apiKeyId = apiKeyId;
    this._apiKeySecretHash = apiKeySecretHash;
    this._apiKeyRotatedAt = new DateValueObject(new Date());
    this.touch();
    this.apply(
      new ClientApiKeyRotatedEvent(
        this.generateEventMetadata(ClientApiKeyRotatedEvent),
        this.toEventData(),
      ),
    );
  }

  public revoke(): void {
    this.assertNotRevoked();
    this._revokedAt = new DateValueObject(new Date());
    this.touch();
    this.apply(
      new ClientRevokedEvent(
        this.generateEventMetadata(ClientRevokedEvent),
        this.toEventData(),
      ),
    );
  }

  /**
   * Persistence-only shape (Phase 11 mapper). MUST NEVER be used to build a
   * domain event payload — `create()`/`rotateApiKey()`/`revoke()` above
   * always call `toEventData()`, never this method, because the api key
   * secret hash must not leave the database via Kafka/EventStore (D15,
   * mirrors D9).
   */
  public toPrimitives(): IClientPrimitives {
    return {
      id: this.id.value,
      tenantId: this._tenantId.value,
      name: this._name.value,
      apiKeyId: this._apiKeyId.value,
      apiKeySecretHash: this._apiKeySecretHash.value,
      apiKeyRotatedAt: this._apiKeyRotatedAt?.value ?? null,
      revokedAt: this._revokedAt?.value ?? null,
      createdAt: this.createdAt.value,
      updatedAt: this.updatedAt.value,
    };
  }

  private assertNotRevoked(): void {
    if (this._revokedAt !== null) {
      throw new ClientRevokedException();
    }
  }

  private toEventData(): IClientEventData {
    return {
      id: this.id.value,
      tenantId: this._tenantId.value,
      name: this._name.value,
      apiKeyId: this._apiKeyId.value,
      createdAt: this.createdAt.value,
      updatedAt: this.updatedAt.value,
    };
  }

  get tenantId(): UuidValueObject {
    return this._tenantId;
  }

  get name(): ClientNameValueObject {
    return this._name;
  }

  get apiKeyId(): ApiKeyIdValueObject {
    return this._apiKeyId;
  }

  get apiKeySecretHash(): ApiKeySecretHashValueObject {
    return this._apiKeySecretHash;
  }

  get apiKeyRotatedAt(): DateValueObject | null {
    return this._apiKeyRotatedAt;
  }

  get revokedAt(): DateValueObject | null {
    return this._revokedAt;
  }
}
