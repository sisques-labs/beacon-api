import { FieldIsRequiredException } from '@sisques-labs/nestjs-kit';

import { ClientAggregate } from '@contexts/clients/domain/aggregates/client.aggregate';
import { ClientCreatedEvent } from '@contexts/clients/domain/events/client-created/client-created.event';
import { ClientViewModel } from '@contexts/clients/domain/view-models/client.view-model';

import { ClientBuilder } from '@contexts/clients/domain/builders/client.builder';

const CLIENT_ID = '880e8400-e29b-41d4-a716-446655440000';
const TENANT_ID = '880e8400-e29b-41d4-a716-446655440001';
const NOW = new Date('2024-01-01T00:00:00.000Z');
const NAME = 'Acme Inc';
const API_KEY_ID = 'a1b2c3d4e5f60718';
const API_KEY_SECRET_HASH = 'a1b2c3d4'.repeat(8);

const seed = (builder: ClientBuilder): ClientBuilder =>
  builder
    .withId(CLIENT_ID)
    .withTenantId(TENANT_ID)
    .withName(NAME)
    .withApiKeyId(API_KEY_ID)
    .withApiKeySecretHash(API_KEY_SECRET_HASH)
    .withCreatedAt(NOW)
    .withUpdatedAt(NOW);

describe('ClientBuilder', () => {
  let builder: ClientBuilder;

  beforeEach(() => {
    builder = new ClientBuilder();
  });

  describe('build()', () => {
    it('returns a ClientAggregate wrapping the given fields', () => {
      const client = seed(builder).build();

      expect(client).toBeInstanceOf(ClientAggregate);
      expect(client.id.value).toBe(CLIENT_ID);
      expect(client.tenantId.value).toBe(TENANT_ID);
      expect(client.name.value).toBe(NAME);
      expect(client.apiKeyId.value).toBe(API_KEY_ID);
      expect(client.apiKeySecretHash.value).toBe(API_KEY_SECRET_HASH);
      expect(client.apiKeyRotatedAt).toBeNull();
      expect(client.revokedAt).toBeNull();
    });

    it('returns an aggregate whose create() emits exactly one ClientCreatedEvent', () => {
      const client = seed(builder).build();

      client.create();

      const events = client.getUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(ClientCreatedEvent);
    });

    it.each([
      ['tenantId', (b: ClientBuilder) => b.withTenantId('')],
      ['name', (b: ClientBuilder) => b.withName('')],
      ['apiKeyId', (b: ClientBuilder) => b.withApiKeyId('')],
      ['apiKeySecretHash', (b: ClientBuilder) => b.withApiKeySecretHash('')],
    ])(
      'throws FieldIsRequiredException when %s is missing',
      (_field, mutate) => {
        const incomplete = mutate(seed(builder));

        expect(() => incomplete.build()).toThrow(FieldIsRequiredException);
      },
    );
  });

  describe('buildViewModel()', () => {
    it('returns a ClientViewModel with no apiKeySecretHash field', () => {
      const vm = seed(builder).buildViewModel();

      expect(vm).toBeInstanceOf(ClientViewModel);
      expect(vm.id).toBe(CLIENT_ID);
      expect(vm.tenantId).toBe(TENANT_ID);
      expect(vm.name).toBe(NAME);
      expect(vm.apiKeyId).toBe(API_KEY_ID);
      expect(vm).not.toHaveProperty('apiKeySecretHash');
    });
  });
});
