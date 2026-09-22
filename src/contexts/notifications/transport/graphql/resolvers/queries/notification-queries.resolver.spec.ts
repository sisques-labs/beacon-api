import { PARAM_ARGS_METADATA } from '@nestjs/graphql';
import { QueryBus } from '@nestjs/cqrs';
import { Criteria, PaginatedResult } from '@sisques-labs/nestjs-kit';
import { FilterValidationPipe } from '@sisques-labs/nestjs-kit/graphql';
import { Mocked, vi } from 'vitest';

import { NotificationFindByCriteriaQuery } from '@contexts/notifications/application/queries/notification-find-by-criteria/notification-find-by-criteria.query';
import { NotificationFindByIdQuery } from '@contexts/notifications/application/queries/notification-find-by-id/notification-find-by-id.query';
import { NotificationViewModel } from '@contexts/notifications/domain/view-models/notification.view-model';
import { NotificationFindByCriteriaRequestDto } from '@contexts/notifications/transport/graphql/dtos/requests/notification-find-by-criteria.request.dto';
import { NotificationFindByIdRequestDto } from '@contexts/notifications/transport/graphql/dtos/requests/notification-find-by-id.request.dto';
import { NotificationPaginatedResponseDto } from '@contexts/notifications/transport/graphql/dtos/responses/notification-paginated.response.dto';
import { NotificationResponseDto } from '@contexts/notifications/transport/graphql/dtos/responses/notification.response.dto';
import { NotificationGraphQLMapper } from '@contexts/notifications/transport/graphql/mappers/notification.mapper';
import { NotificationQueriesResolver } from '@contexts/notifications/transport/graphql/resolvers/queries/notification-queries.resolver';

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
    deliveryMode: 'DELIVER',
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
      toPaginatedResponseDtoFromPaginatedResult: vi.fn(),
    } as unknown as Mocked<NotificationGraphQLMapper>;
    resolver = new NotificationQueriesResolver(queryBus, mapper);
  });

  it('dispatches NotificationFindByIdQuery and maps the result', async () => {
    const viewModel = buildViewModel();
    const dto = new NotificationResponseDto();
    const input: NotificationFindByIdRequestDto = { id: viewModel.id };
    queryBus.execute.mockResolvedValue(viewModel);
    mapper.toResponseDtoFromViewModel.mockReturnValue(dto);

    const result = await resolver.notificationFindById(input);

    expect(queryBus.execute).toHaveBeenCalledWith(
      new NotificationFindByIdQuery({ id: viewModel.id }),
    );
    expect(mapper.toResponseDtoFromViewModel).toHaveBeenCalledWith(viewModel);
    expect(result).toBe(dto);
  });

  describe('notificationsFindByCriteria', () => {
    it('dispatches NotificationFindByCriteriaQuery built from the input and maps via the mapper', async () => {
      const viewModel = buildViewModel();
      const paginatedResult = new PaginatedResult([viewModel], 1, 1, 10);
      const paginatedDto = new NotificationPaginatedResponseDto();
      const input: NotificationFindByCriteriaRequestDto = {
        filters: [],
        sorts: [],
        pagination: { page: 1, perPage: 10 },
      };
      queryBus.execute.mockResolvedValue(paginatedResult);
      mapper.toPaginatedResponseDtoFromPaginatedResult.mockReturnValue(
        paginatedDto,
      );

      const result = await resolver.notificationsFindByCriteria(input);

      expect(queryBus.execute).toHaveBeenCalledWith(
        expect.any(NotificationFindByCriteriaQuery),
      );
      const dispatchedQuery = queryBus.execute.mock
        .calls[0][0] as NotificationFindByCriteriaQuery;
      expect(dispatchedQuery.criteria).toEqual(
        new Criteria(input.filters, input.sorts, input.pagination),
      );
      expect(
        mapper.toPaginatedResponseDtoFromPaginatedResult,
      ).toHaveBeenCalledWith(paginatedResult);
      expect(result).toBe(paginatedDto);
    });

    it('builds an empty Criteria when the input is undefined', async () => {
      const paginatedResult = new PaginatedResult<NotificationViewModel>(
        [],
        0,
        1,
        10,
      );
      const paginatedDto = new NotificationPaginatedResponseDto();
      queryBus.execute.mockResolvedValue(paginatedResult);
      mapper.toPaginatedResponseDtoFromPaginatedResult.mockReturnValue(
        paginatedDto,
      );

      await resolver.notificationsFindByCriteria(undefined);

      const dispatchedQuery = queryBus.execute.mock
        .calls[0][0] as NotificationFindByCriteriaQuery;
      expect(dispatchedQuery.criteria).toEqual(new Criteria());
    });

    it('wires FilterValidationPipe as the third @Args argument', () => {
      const metadata = Reflect.getMetadata(
        PARAM_ARGS_METADATA,
        NotificationQueriesResolver,
        'notificationsFindByCriteria',
      ) as Record<string, { data: unknown; pipes: unknown[] }>;

      const argEntry = Object.values(metadata ?? {}).find(
        (entry) => entry.data === 'input',
      );

      expect(argEntry).toBeDefined();
      expect(
        argEntry?.pipes.some((pipe) => pipe instanceof FilterValidationPipe),
      ).toBe(true);
    });
  });
});
