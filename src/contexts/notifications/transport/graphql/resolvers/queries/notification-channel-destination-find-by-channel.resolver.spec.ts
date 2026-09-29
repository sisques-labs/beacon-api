import { QueryBus } from '@nestjs/cqrs';
import {
  Criteria,
  FilterOperator,
  PaginatedResult,
} from '@sisques-labs/nestjs-kit';
import { Mocked, vi } from 'vitest';

import { IAuthenticatedClient } from '@contexts/notifications/application/ports/authenticated-client.interface';
import { NotificationChannelDestinationFindByCriteriaQuery } from '@contexts/notifications/application/queries/notification-channel-destination-find-by-criteria/notification-channel-destination-find-by-criteria.query';
import { NotificationChannelEnum } from '@contexts/notifications/domain/enums/notification-channel.enum';
import { NotificationChannelDestinationViewModel } from '@contexts/notifications/domain/view-models/notification-channel-destination.view-model';
import { NotificationChannelDestinationFindByChannelRequestDto } from '@contexts/notifications/transport/graphql/dtos/requests/notification-channel-destination-find-by-channel.request.dto';
import { NotificationChannelDestinationResponseDto } from '@contexts/notifications/transport/graphql/dtos/responses/notification-channel-destination.response.dto';
import { NotificationChannelDestinationGraphQLMapper } from '@contexts/notifications/transport/graphql/mappers/notification-channel-destination.mapper';
import { NotificationChannelDestinationFindByChannelResolver } from '@contexts/notifications/transport/graphql/resolvers/queries/notification-channel-destination-find-by-channel.resolver';

const AUTHENTICATED_CLIENT: IAuthenticatedClient = {
  clientId: '99999999-9999-4999-8999-999999999999',
  tenantId: '22222222-2222-4222-8222-222222222222',
};

function buildRequestDto(): NotificationChannelDestinationFindByChannelRequestDto {
  const dto = new NotificationChannelDestinationFindByChannelRequestDto();
  dto.channel = NotificationChannelEnum.DISCORD;
  return dto;
}

function emptyPage(): PaginatedResult<NotificationChannelDestinationViewModel> {
  return new PaginatedResult([], 0, 1, 10);
}

function buildViewModel(): NotificationChannelDestinationViewModel {
  return new NotificationChannelDestinationViewModel({
    id: '11111111-1111-4111-8111-111111111111',
    tenantId: AUTHENTICATED_CLIENT.tenantId,
    channel: 'DISCORD',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  });
}

describe('NotificationChannelDestinationFindByChannelResolver', () => {
  let resolver: NotificationChannelDestinationFindByChannelResolver;
  let queryBus: Mocked<QueryBus>;
  let mapper: Mocked<NotificationChannelDestinationGraphQLMapper>;

  beforeEach(() => {
    queryBus = { execute: vi.fn() } as unknown as Mocked<QueryBus>;
    mapper = {
      toResponseDtoFromViewModel: vi.fn(),
    } as unknown as Mocked<NotificationChannelDestinationGraphQLMapper>;
    resolver = new NotificationChannelDestinationFindByChannelResolver(
      queryBus,
      mapper,
    );
  });

  it('dispatches NotificationChannelDestinationFindByCriteriaQuery for the authenticated tenant only', async () => {
    const dto = buildRequestDto();
    queryBus.execute.mockResolvedValue(emptyPage());
    mapper.toResponseDtoFromViewModel.mockReturnValue(
      new NotificationChannelDestinationResponseDto(),
    );

    await resolver.notificationChannelDestinationFindByChannel(
      dto,
      AUTHENTICATED_CLIENT,
    );

    expect(queryBus.execute).toHaveBeenCalledTimes(1);
    expect(queryBus.execute).toHaveBeenCalledWith(
      new NotificationChannelDestinationFindByCriteriaQuery({
        criteria: new Criteria([
          {
            field: 'tenantId',
            operator: FilterOperator.EQUALS,
            value: AUTHENTICATED_CLIENT.tenantId,
          },
          {
            field: 'channel',
            operator: FilterOperator.EQUALS,
            value: dto.channel,
          },
        ]),
      }),
    );
  });

  it('returns the response DTO built by the mapper from the view model', async () => {
    const dto = buildRequestDto();
    const viewModel = buildViewModel();
    const responseDto = new NotificationChannelDestinationResponseDto();
    responseDto.configured = true;
    queryBus.execute.mockResolvedValue(
      new PaginatedResult([viewModel], 1, 1, 10),
    );
    mapper.toResponseDtoFromViewModel.mockReturnValue(responseDto);

    const result = await resolver.notificationChannelDestinationFindByChannel(
      dto,
      AUTHENTICATED_CLIENT,
    );

    expect(mapper.toResponseDtoFromViewModel).toHaveBeenCalledWith(viewModel);
    expect(result).toBe(responseDto);
  });

  it('maps an empty page to an unconfigured response DTO via the mapper', async () => {
    const dto = buildRequestDto();
    queryBus.execute.mockResolvedValue(emptyPage());
    const responseDto = new NotificationChannelDestinationResponseDto();
    responseDto.configured = false;
    mapper.toResponseDtoFromViewModel.mockReturnValue(responseDto);

    const result = await resolver.notificationChannelDestinationFindByChannel(
      dto,
      AUTHENTICATED_CLIENT,
    );

    expect(mapper.toResponseDtoFromViewModel).toHaveBeenCalledWith(null);
    expect(result).toBe(responseDto);
  });
});
