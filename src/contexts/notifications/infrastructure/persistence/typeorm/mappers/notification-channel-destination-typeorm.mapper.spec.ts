import { NotificationChannelDestinationBuilder } from '@contexts/notifications/domain/builders/notification-channel-destination.builder';
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
  const mapper = new NotificationChannelDestinationTypeormMapper(
    new NotificationChannelDestinationBuilder(),
  );

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

  describe('shared builder instance (singleton provider)', () => {
    it('does not leak state between consecutive toAggregate calls', () => {
      const other = buildEntity({
        id: '33333333-3333-4333-8333-333333333333',
        tenantId: '44444444-4444-4444-8444-444444444444',
        encryptedAddress:
          'v1:cccccccccccccccccccc:dddddddddddddddddddddddddddddddd:b3RoZXI',
        createdAt: new Date('2026-02-02T00:00:00.000Z'),
        updatedAt: new Date('2026-03-03T00:00:00.000Z'),
      });

      mapper.toAggregate(buildEntity());
      const second = mapper.toAggregate(other);

      expect(second.id.value).toBe(other.id);
      expect(second.tenantId.value).toBe(other.tenantId);
      expect(second.envelope.value).toBe(other.encryptedAddress);
      expect(second.createdAt.value).toEqual(other.createdAt);
      expect(second.updatedAt.value).toEqual(other.updatedAt);
    });

    it('fails validation on a missing envelope instead of reusing the previous one', () => {
      mapper.toAggregate(buildEntity());

      expect(() =>
        mapper.toAggregate(buildEntity({ encryptedAddress: undefined })),
      ).toThrow();
    });
  });
});
