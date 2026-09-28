import { QueryBus } from '@nestjs/cqrs';
import { Mocked, vi } from 'vitest';

import { IAuthenticatedClient } from '@contexts/notifications/application/ports/authenticated-client.interface';
import { NotificationChannelDestinationFindByTenantAndChannelQuery } from '@contexts/notifications/application/queries/notification-channel-destination-find-by-tenant-and-channel/notification-channel-destination-find-by-tenant-and-channel.query';
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

  it('dispatches NotificationChannelDestinationFindByTenantAndChannelQuery for the authenticated tenant only', async () => {
    const dto = buildRequestDto();
    queryBus.execute.mockResolvedValue(null);
    mapper.toResponseDtoFromViewModel.mockReturnValue(
      new NotificationChannelDestinationResponseDto(),
    );

    await resolver.notificationChannelDestinationFindByChannel(
      dto,
      AUTHENTICATED_CLIENT,
    );

    expect(queryBus.execute).toHaveBeenCalledTimes(1);
    expect(queryBus.execute).toHaveBeenCalledWith(
      new NotificationChannelDestinationFindByTenantAndChannelQuery({
        tenantId: AUTHENTICATED_CLIENT.tenantId,
        channel: dto.channel,
      }),
    );
  });

  it('returns the response DTO built by the mapper from the view model', async () => {
    const dto = buildRequestDto();
    const viewModel = buildViewModel();
    const responseDto = new NotificationChannelDestinationResponseDto();
    responseDto.configured = true;
    queryBus.execute.mockResolvedValue(viewModel);
    mapper.toResponseDtoFromViewModel.mockReturnValue(responseDto);

    const result = await resolver.notificationChannelDestinationFindByChannel(
      dto,
      AUTHENTICATED_CLIENT,
    );

    expect(mapper.toResponseDtoFromViewModel).toHaveBeenCalledWith(viewModel);
    expect(result).toBe(responseDto);
  });

  it('maps a null view model to an unconfigured response DTO via the mapper', async () => {
    const dto = buildRequestDto();
    queryBus.execute.mockResolvedValue(null);
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
