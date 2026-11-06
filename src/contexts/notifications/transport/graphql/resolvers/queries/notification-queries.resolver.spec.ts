import { QueryBus } from '@nestjs/cqrs';
import { Mocked, vi } from 'vitest';

import { NotificationFindByIdQuery } from '@contexts/notifications/application/queries/notification-find-by-id/notification-find-by-id.query';
import { IAuthenticatedClient } from '@contexts/notifications/application/ports/authenticated-client.interface';
import { NotificationViewModel } from '@contexts/notifications/domain/view-models/notification.view-model';
import { NotificationFindByIdRequestDto } from '@contexts/notifications/transport/graphql/dtos/requests/notification-find-by-id.request.dto';
import { NotificationResponseDto } from '@contexts/notifications/transport/graphql/dtos/responses/notification.response.dto';
import { NotificationGraphQLMapper } from '@contexts/notifications/transport/graphql/mappers/notification.mapper';
import { NotificationQueriesResolver } from '@contexts/notifications/transport/graphql/resolvers/queries/notification-queries.resolver';

const AUTHENTICATED_CLIENT: IAuthenticatedClient = {
  clientId: '99999999-9999-4999-8999-999999999999',
  tenantId: '22222222-2222-4222-8222-222222222222',
};

function buildViewModel(): NotificationViewModel {
  return new NotificationViewModel({
    id: '11111111-1111-4111-8111-111111111111',
    tenantId: AUTHENTICATED_CLIENT.tenantId,
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

describe('NotificationQueriesResolver', () => {
  let resolver: NotificationQueriesResolver;
  let queryBus: Mocked<QueryBus>;
  let mapper: Mocked<NotificationGraphQLMapper>;

  beforeEach(() => {
    queryBus = { execute: vi.fn() } as unknown as Mocked<QueryBus>;
    mapper = {
      toResponseDtoFromViewModel: vi.fn(),
    } as unknown as Mocked<NotificationGraphQLMapper>;
    resolver = new NotificationQueriesResolver(queryBus, mapper);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('dispatches NotificationFindByIdQuery with the requested id and the authenticated tenant (D25) and maps the result', async () => {
    const viewModel = buildViewModel();
    const dto = new NotificationResponseDto();
    const input: NotificationFindByIdRequestDto = { id: viewModel.id };
    queryBus.execute.mockResolvedValue(viewModel);
    mapper.toResponseDtoFromViewModel.mockReturnValue(dto);

    const result = await resolver.notificationFindById(
      input,
      AUTHENTICATED_CLIENT,
    );

    expect(queryBus.execute).toHaveBeenCalledWith(
      new NotificationFindByIdQuery({
        id: viewModel.id,
        tenantId: AUTHENTICATED_CLIENT.tenantId,
      }),
    );
    expect(mapper.toResponseDtoFromViewModel).toHaveBeenCalledWith(viewModel);
    expect(result).toBe(dto);
  });
});
