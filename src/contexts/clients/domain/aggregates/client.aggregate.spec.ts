import { DateValueObject, UuidValueObject } from '@sisques-labs/nestjs-kit';

import { ClientApiKeyRotatedEvent } from '@contexts/clients/domain/events/client-api-key-rotated/client-api-key-rotated.event';
import { ClientCreatedEvent } from '@contexts/clients/domain/events/client-created/client-created.event';
import { ClientRevokedEvent } from '@contexts/clients/domain/events/client-revoked/client-revoked.event';
import { ClientRevokedException } from '@contexts/clients/domain/exceptions/client-revoked.exception';
import { ApiKeyIdValueObject } from '@contexts/clients/domain/value-objects/api-key-id/api-key-id.value-object';
import { ApiKeySecretHashValueObject } from '@contexts/clients/domain/value-objects/api-key-secret-hash/api-key-secret-hash.value-object';
import { ClientNameValueObject } from '@contexts/clients/domain/value-objects/client-name/client-name.value-object';

import { ClientAggregate } from '@contexts/clients/domain/aggregates/client.aggregate';

const CLIENT_ID = '770e8400-e29b-41d4-a716-446655440000';
const TENANT_ID = '770e8400-e29b-41d4-a716-446655440001';
const NOW = new Date('2024-01-01T00:00:00.000Z');
const NAME = 'Acme Inc';
const API_KEY_ID_1 = 'a1b2c3d4e5f60718';
const API_KEY_ID_2 = '0011223344556677';
const HASH_1 = 'a1b2c3d4'.repeat(8);
const HASH_2 = 'e5f6a7b8'.repeat(8);

const buildClient = (revokedAt: Date | null = null): ClientAggregate =>
  new ClientAggregate({
    id: new UuidValueObject(CLIENT_ID),
    tenantId: new UuidValueObject(TENANT_ID),
    name: new ClientNameValueObject(NAME),
    apiKeyId: new ApiKeyIdValueObject(API_KEY_ID_1),
    apiKeySecretHash: new ApiKeySecretHashValueObject(HASH_1),
    apiKeyRotatedAt: null,
    revokedAt: revokedAt ? new DateValueObject(revokedAt) : null,
    createdAt: new DateValueObject(NOW),
    updatedAt: new DateValueObject(NOW),
  });

describe('ClientAggregate', () => {
  describe('constructor', () => {
    it('never emits an event on hydration', () => {
      const client = buildClient();

      expect(client.getUncommittedEvents()).toHaveLength(0);
    });
  });

  describe('create()', () => {
    it('emits ClientCreatedEvent with metadata-only payload', () => {
      const client = buildClient();

      client.create();

      const events = client.getUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(ClientCreatedEvent);

      const event = events[0] as ClientCreatedEvent;
      expect(event.data).toEqual({
        id: CLIENT_ID,
        tenantId: TENANT_ID,
        name: NAME,
        apiKeyId: API_KEY_ID_1,
        createdAt: NOW,
        updatedAt: NOW,
      });
    });

    it('never includes the api key secret hash in the created event payload', () => {
      const client = buildClient();

      client.create();

      const event = client.getUncommittedEvents()[0] as ClientCreatedEvent;
      expect(Object.keys(event.data)).toEqual([
        'id',
        'tenantId',
        'name',
        'apiKeyId',
        'createdAt',
        'updatedAt',
      ]);
      expect(JSON.stringify(event.data)).not.toContain(HASH_1);
    });
  });

  describe('rotateApiKey()', () => {
    it('replaces the apiKeyId and hash, touches apiKeyRotatedAt/updatedAt, and emits ClientApiKeyRotatedEvent', () => {
      const client = buildClient();

      client.rotateApiKey(
        new ApiKeyIdValueObject(API_KEY_ID_2),
        new ApiKeySecretHashValueObject(HASH_2),
      );

      expect(client.apiKeyId.value).toBe(API_KEY_ID_2);
      expect(client.apiKeySecretHash.value).toBe(HASH_2);
      expect(client.apiKeyRotatedAt?.value.getTime()).toBeGreaterThanOrEqual(
        NOW.getTime(),
      );
      expect(client.updatedAt.value.getTime()).toBeGreaterThanOrEqual(
        NOW.getTime(),
      );

      const events = client.getUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(ClientApiKeyRotatedEvent);
    });

    it('never includes the api key secret hash in the rotated event payload', () => {
      const client = buildClient();

      client.rotateApiKey(
        new ApiKeyIdValueObject(API_KEY_ID_2),
        new ApiKeySecretHashValueObject(HASH_2),
      );

      const event =
        client.getUncommittedEvents()[0] as ClientApiKeyRotatedEvent;
      expect(Object.keys(event.data)).toEqual([
        'id',
        'tenantId',
        'name',
        'apiKeyId',
        'createdAt',
        'updatedAt',
      ]);
      expect(JSON.stringify(event.data)).not.toContain(HASH_2);
    });

    it('throws ClientRevokedException when the client is already revoked', () => {
      const client = buildClient(NOW);

      expect(() =>
        client.rotateApiKey(
          new ApiKeyIdValueObject(API_KEY_ID_2),
          new ApiKeySecretHashValueObject(HASH_2),
        ),
      ).toThrow(ClientRevokedException);
    });
  });

  describe('revoke()', () => {
    it('sets revokedAt, touches updatedAt, and emits ClientRevokedEvent', () => {
      const client = buildClient();

      client.revoke();

      expect(client.revokedAt?.value.getTime()).toBeGreaterThanOrEqual(
        NOW.getTime(),
      );
      expect(client.updatedAt.value.getTime()).toBeGreaterThanOrEqual(
        NOW.getTime(),
      );

      const events = client.getUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(ClientRevokedEvent);
    });

    it('throws ClientRevokedException when the client is already revoked', () => {
      const client = buildClient(NOW);

      expect(() => client.revoke()).toThrow(ClientRevokedException);
    });

    it('never includes the api key secret hash in the revoked event payload', () => {
      const client = buildClient();

      client.revoke();

      const event = client.getUncommittedEvents()[0] as ClientRevokedEvent;
      expect(Object.keys(event.data)).toEqual([
        'id',
        'tenantId',
        'name',
        'apiKeyId',
        'createdAt',
        'updatedAt',
      ]);
      expect(JSON.stringify(event.data)).not.toContain(HASH_1);
    });
  });

  describe('toPrimitives()', () => {
    it('returns the persistence shape including the api key secret hash', () => {
      const client = buildClient();

      expect(client.toPrimitives()).toEqual({
        id: CLIENT_ID,
        tenantId: TENANT_ID,
        name: NAME,
        apiKeyId: API_KEY_ID_1,
        apiKeySecretHash: HASH_1,
        apiKeyRotatedAt: null,
        revokedAt: null,
        createdAt: NOW,
        updatedAt: NOW,
      });
    });

    it('reflects the rotated apiKeyId/hash and the touched updatedAt', () => {
      const client = buildClient();

      client.rotateApiKey(
        new ApiKeyIdValueObject(API_KEY_ID_2),
        new ApiKeySecretHashValueObject(HASH_2),
      );
      const primitives = client.toPrimitives();

      expect(primitives.apiKeyId).toBe(API_KEY_ID_2);
      expect(primitives.apiKeySecretHash).toBe(HASH_2);
      expect(primitives.apiKeyRotatedAt?.getTime()).toBeGreaterThanOrEqual(
        NOW.getTime(),
      );
      expect(primitives.updatedAt.getTime()).toBeGreaterThanOrEqual(
        NOW.getTime(),
      );
    });
  });

  describe('getters', () => {
    it('exposes tenantId, name, apiKeyId, and apiKeySecretHash value objects', () => {
      const client = buildClient();

      expect(client.tenantId.value).toBe(TENANT_ID);
      expect(client.name.value).toBe(NAME);
      expect(client.apiKeyId.value).toBe(API_KEY_ID_1);
      expect(client.apiKeySecretHash.value).toBe(HASH_1);
      expect(client.apiKeyRotatedAt).toBeNull();
      expect(client.revokedAt).toBeNull();
    });
  });
});
