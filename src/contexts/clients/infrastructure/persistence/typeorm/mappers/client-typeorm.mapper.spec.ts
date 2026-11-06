import { ClientEntity } from '@contexts/clients/infrastructure/persistence/typeorm/entities/client.entity';
import { ClientTypeormMapper } from '@contexts/clients/infrastructure/persistence/typeorm/mappers/client-typeorm.mapper';

const API_KEY_SECRET_HASH = 'a'.repeat(32) + 'b'.repeat(32); // 64 lowercase-hex chars (D17)
const API_KEY_ID = 'a1b2c3d4e5f60718'; // 16 lowercase-hex chars (D16)

function buildEntity(overrides: Partial<ClientEntity> = {}) {
  const entity = new ClientEntity();
  entity.id = '11111111-1111-4111-8111-111111111111';
  entity.tenantId = '22222222-2222-4222-8222-222222222222';
  entity.name = 'Acme Inc.';
  entity.apiKeyId = API_KEY_ID;
  entity.apiKeySecretHash = API_KEY_SECRET_HASH;
  entity.apiKeyRotatedAt = null;
  entity.revokedAt = null;
  entity.createdAt = new Date('2026-01-01T00:00:00.000Z');
  entity.updatedAt = new Date('2026-01-01T00:00:00.000Z');
  entity.deletedAt = null;
  return Object.assign(entity, overrides);
}

describe('ClientTypeormMapper', () => {
  const mapper = new ClientTypeormMapper();

  it('maps an entity to an aggregate, round-tripping the api key secret hash verbatim', () => {
    const entity = buildEntity();

    const aggregate = mapper.toAggregate(entity);

    expect(aggregate.id.value).toBe(entity.id);
    expect(aggregate.tenantId.value).toBe(entity.tenantId);
    expect(aggregate.name.value).toBe(entity.name);
    expect(aggregate.apiKeyId.value).toBe(entity.apiKeyId);
    expect(aggregate.apiKeySecretHash.value).toBe(API_KEY_SECRET_HASH);
    expect(aggregate.apiKeyRotatedAt).toBeNull();
    expect(aggregate.revokedAt).toBeNull();
  });

  it('maps a rotated/revoked entity to an aggregate, preserving both timestamps', () => {
    const rotatedAt = new Date('2026-02-01T00:00:00.000Z');
    const revokedAt = new Date('2026-03-01T00:00:00.000Z');
    const entity = buildEntity({
      apiKeyRotatedAt: rotatedAt,
      revokedAt,
    });

    const aggregate = mapper.toAggregate(entity);

    expect(aggregate.apiKeyRotatedAt?.value).toEqual(rotatedAt);
    expect(aggregate.revokedAt?.value).toEqual(revokedAt);
  });

  it('maps an aggregate back to an entity, preserving the api key secret hash column (round trip)', () => {
    const entity = buildEntity();

    const aggregate = mapper.toAggregate(entity);
    const persisted = mapper.toEntity(aggregate);

    expect(persisted.id).toBe(entity.id);
    expect(persisted.tenantId).toBe(entity.tenantId);
    expect(persisted.name).toBe(entity.name);
    expect(persisted.apiKeyId).toBe(entity.apiKeyId);
    expect(persisted.apiKeySecretHash).toBe(API_KEY_SECRET_HASH);
    expect(persisted.apiKeyRotatedAt).toBeNull();
    expect(persisted.revokedAt).toBeNull();
  });

  it('maps an entity to a view model without ever reading or exposing the api key secret hash', () => {
    const entity = buildEntity({ apiKeySecretHash: undefined });

    const viewModel = mapper.toViewModel(entity);

    expect(viewModel.id).toBe(entity.id);
    expect(viewModel.tenantId).toBe(entity.tenantId);
    expect(viewModel.name).toBe(entity.name);
    expect(viewModel.apiKeyId).toBe(entity.apiKeyId);
    expect(viewModel).not.toHaveProperty('apiKeySecretHash');
  });
});
