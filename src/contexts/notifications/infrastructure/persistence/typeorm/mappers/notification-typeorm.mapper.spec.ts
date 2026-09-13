import { NotificationChannelEnum } from '@contexts/notifications/domain/enums/notification-channel.enum';
import { NotificationStatusEnum } from '@contexts/notifications/domain/enums/notification-status.enum';
import { NotificationEntity } from '@contexts/notifications/infrastructure/persistence/typeorm/entities/notification.entity';
import { NotificationTypeormMapper } from '@contexts/notifications/infrastructure/persistence/typeorm/mappers/notification-typeorm.mapper';

function buildEntity(overrides: Partial<NotificationEntity> = {}) {
  const entity = new NotificationEntity();
  entity.id = '11111111-1111-4111-8111-111111111111';
  entity.tenantId = '22222222-2222-4222-8222-222222222222';
  entity.recipientUserId = '33333333-3333-4333-8333-333333333333';
  entity.channel = NotificationChannelEnum.DISCORD;
  entity.status = NotificationStatusEnum.PENDING;
  entity.title = 'Title';
  entity.body = 'Body';
  entity.sourceService = 'gardenia';
  entity.dedupeKey = 'dedupe-key-1';
  entity.failureReason = null;
  entity.sentAt = null;
  entity.readAt = null;
  entity.cancelledAt = null;
  entity.createdAt = new Date('2026-01-01T00:00:00.000Z');
  entity.updatedAt = new Date('2026-01-01T00:00:00.000Z');
  entity.deletedAt = null;
  return Object.assign(entity, overrides);
}

describe('NotificationTypeormMapper', () => {
  const mapper = new NotificationTypeormMapper();

  it('maps an entity to an aggregate preserving all fields', () => {
    const entity = buildEntity();

    const aggregate = mapper.toAggregate(entity);

    expect(aggregate.id.value).toBe(entity.id);
    expect(aggregate.tenantId.value).toBe(entity.tenantId);
    expect(aggregate.recipientUserId.value).toBe(entity.recipientUserId);
    expect(aggregate.channel.value).toBe(entity.channel);
    expect(aggregate.status.value).toBe(entity.status);
    expect(aggregate.title.value).toBe(entity.title);
    expect(aggregate.body.value).toBe(entity.body);
    expect(aggregate.sourceService.value).toBe(entity.sourceService);
    expect(aggregate.dedupeKey.value).toBe(entity.dedupeKey);
    expect(aggregate.failureReason).toBeNull();
  });

  it('maps an aggregate back to an entity (round trip)', () => {
    const entity = buildEntity({
      failureReason: 'boom',
      sentAt: new Date('2026-02-01T00:00:00.000Z'),
    });

    const aggregate = mapper.toAggregate(entity);
    const persisted = mapper.toEntity(aggregate);

    expect(persisted.id).toBe(entity.id);
    expect(persisted.tenantId).toBe(entity.tenantId);
    expect(persisted.dedupeKey).toBe(entity.dedupeKey);
    expect(persisted.failureReason).toBe('boom');
    expect(persisted.sentAt).toEqual(entity.sentAt);
  });

  it('maps an entity to a view model', () => {
    const entity = buildEntity();

    const viewModel = mapper.toViewModel(entity);

    expect(viewModel.id).toBe(entity.id);
    expect(viewModel.tenantId).toBe(entity.tenantId);
    expect(viewModel.status).toBe(entity.status);
    expect(viewModel.dedupeKey).toBe(entity.dedupeKey);
  });
});
