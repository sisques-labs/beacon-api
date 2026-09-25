import { NotificationChannelEnum } from '@contexts/notifications/domain/enums/notification-channel.enum';
import { NotificationChannelDestinationEntity } from '@contexts/notifications/infrastructure/persistence/typeorm/entities/notification-channel-destination.entity';
import { NotificationChannelDestinationTypeormMapper } from '@contexts/notifications/infrastructure/persistence/typeorm/mappers/notification-channel-destination-typeorm.mapper';

const ENVELOPE =
  'v1:aaaaaaaaaaaaaaaaaaaa:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb:Y2lwaGVydGV4dA';

function buildEntity(
  overrides: Partial<NotificationChannelDestinationEntity> = {},
) {
  const entity = new NotificationChannelDestinationEntity();
  entity.id = '11111111-1111-4111-8111-111111111111';
  entity.tenantId = '22222222-2222-4222-8222-222222222222';
  entity.channel = NotificationChannelEnum.DISCORD;
  entity.encryptedAddress = ENVELOPE;
  entity.createdAt = new Date('2026-01-01T00:00:00.000Z');
  entity.updatedAt = new Date('2026-01-01T00:00:00.000Z');
  entity.deletedAt = null;
  return Object.assign(entity, overrides);
}

describe('NotificationChannelDestinationTypeormMapper', () => {
  const mapper = new NotificationChannelDestinationTypeormMapper();

  it('maps an entity to an aggregate, round-tripping the encrypted envelope verbatim', () => {
    const entity = buildEntity();

    const aggregate = mapper.toAggregate(entity);

    expect(aggregate.id.value).toBe(entity.id);
    expect(aggregate.tenantId.value).toBe(entity.tenantId);
    expect(aggregate.channel.value).toBe(entity.channel);
    expect(aggregate.envelope.value).toBe(ENVELOPE);
  });

  it('maps an aggregate back to an entity, preserving the envelope column (round trip)', () => {
    const entity = buildEntity();

    const aggregate = mapper.toAggregate(entity);
    const persisted = mapper.toEntity(aggregate);

    expect(persisted.id).toBe(entity.id);
    expect(persisted.tenantId).toBe(entity.tenantId);
    expect(persisted.channel).toBe(entity.channel);
    expect(persisted.encryptedAddress).toBe(ENVELOPE);
  });

  it('maps an entity to a view model without ever reading or exposing the encrypted envelope', () => {
    const entity = buildEntity({ encryptedAddress: undefined });

    const viewModel = mapper.toViewModel(entity);

    expect(viewModel.id).toBe(entity.id);
    expect(viewModel.tenantId).toBe(entity.tenantId);
    expect(viewModel.channel).toBe(entity.channel);
    expect(viewModel).not.toHaveProperty('envelope');
    expect(viewModel).not.toHaveProperty('encryptedAddress');
  });
});
