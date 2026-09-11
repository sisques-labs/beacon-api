import { QueryBus } from '@nestjs/cqrs';
import { Mocked, vi } from 'vitest';

import { NotificationFindByIdQuery } from '@contexts/notifications/application/queries/notification-find-by-id/notification-find-by-id.query';
import { NotificationViewModel } from '@contexts/notifications/domain/view-models/notification.view-model';
import { NotificationGraphqlMapper } from '@contexts/notifications/transport/graphql/mappers/notification.mapper';
import { NotificationObject } from '@contexts/notifications/transport/graphql/objects/notification.object';
import { NotificationResolver } from '@contexts/notifications/transport/graphql/resolvers/notification.resolver';

function buildViewModel(): NotificationViewModel {
  return new NotificationViewModel({
    id: '11111111-1111-4111-8111-111111111111',
    tenantId: '22222222-2222-4222-8222-222222222222',
    recipientUserId: '33333333-3333-4333-8333-333333333333',
    channel: 'DISCORD',
    status: 'PENDING',
    title: 'Title',
    body: 'Body',
    sourceService: 'gardenia',
    dedupeKey: 'dedupe-key-1',
    failureReason: null,
    sentAt: null,
    readAt: null,
    cancelledAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  });
}

describe('NotificationResolver', () => {
  let resolver: NotificationResolver;
  let queryBus: Mocked<QueryBus>;
  let mapper: Mocked<NotificationGraphqlMapper>;

  beforeEach(() => {
    queryBus = { execute: vi.fn() } as unknown as Mocked<QueryBus>;
    mapper = {
      toObject: vi.fn(),
    } as unknown as Mocked<NotificationGraphqlMapper>;
    resolver = new NotificationResolver(queryBus, mapper);
  });

  it('dispatches NotificationFindByIdQuery and maps the result', async () => {
    const viewModel = buildViewModel();
    const object = new NotificationObject();
    queryBus.execute.mockResolvedValue(viewModel);
    mapper.toObject.mockReturnValue(object);

    const result = await resolver.notificationFindById(viewModel.id);

    expect(queryBus.execute).toHaveBeenCalledWith(
      new NotificationFindByIdQuery({ id: viewModel.id }),
    );
    expect(mapper.toObject).toHaveBeenCalledWith(viewModel);
    expect(result).toBe(object);
  });
});
