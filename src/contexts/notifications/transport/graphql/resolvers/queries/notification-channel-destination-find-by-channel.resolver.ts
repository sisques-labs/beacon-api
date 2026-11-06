import { Logger, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { Args, Query, Resolver } from '@nestjs/graphql';
import {
  Criteria,
  FilterOperator,
  PaginatedResult,
} from '@sisques-labs/nestjs-kit';

import { NotificationChannelDestinationFindByCriteriaQuery } from '@contexts/notifications/application/queries/notification-channel-destination-find-by-criteria/notification-channel-destination-find-by-criteria.query';
import { IAuthenticatedClient } from '@contexts/notifications/application/ports/authenticated-client.interface';
import { NotificationChannelDestinationViewModel } from '@contexts/notifications/domain/view-models/notification-channel-destination.view-model';
import { CurrentClient } from '@contexts/notifications/infrastructure/decorators/current-client.decorator';
import { ClientApiKeyGuard } from '@contexts/notifications/infrastructure/guards/client-api-key.guard';
import { NotificationChannelDestinationFindByChannelRequestDto } from '@contexts/notifications/transport/graphql/dtos/requests/notification-channel-destination-find-by-channel.request.dto';
import { NotificationChannelDestinationResponseDto } from '@contexts/notifications/transport/graphql/dtos/responses/notification-channel-destination.response.dto';
import { NotificationChannelDestinationGraphQLMapper } from '@contexts/notifications/transport/graphql/mappers/notification-channel-destination.mapper';

/**
 * D24: the target tenant is always the authenticated client's own tenant,
 * resolved through `@CurrentClient()` — never taken from the query input
 * (spec: "API-Key-Authenticated Registration and Reads"). Class-level
 * `@UseGuards(ClientApiKeyGuard)` (D21) covers this resolver; the guard
 * reflection spec enforces this pairing across `notifications/transport/`.
 */
@Resolver()
@UseGuards(ClientApiKeyGuard)
export class NotificationChannelDestinationFindByChannelResolver {
  private readonly logger = new Logger(
    NotificationChannelDestinationFindByChannelResolver.name,
  );

  constructor(
    private readonly queryBus: QueryBus,
    private readonly notificationChannelDestinationGraphQLMapper: NotificationChannelDestinationGraphQLMapper,
  ) {}

  @Query(() => NotificationChannelDestinationResponseDto, {
    name: 'notificationChannelDestinationFindByChannel',
    description: "Read the caller's own webhook metadata",
  })
  async notificationChannelDestinationFindByChannel(
    @Args('input') input: NotificationChannelDestinationFindByChannelRequestDto,
    @CurrentClient() authenticatedClient: IAuthenticatedClient,
  ): Promise<NotificationChannelDestinationResponseDto> {
    this.logger.log(
      `GraphQL notificationChannelDestinationFindByChannel tenant=${authenticatedClient.tenantId}`,
    );

    // The unique index (tenantId, channel) guarantees at most one row, so the
    // default first page is enough.
    const result = await this.queryBus.execute<
      NotificationChannelDestinationFindByCriteriaQuery,
      PaginatedResult<NotificationChannelDestinationViewModel>
    >(
      new NotificationChannelDestinationFindByCriteriaQuery({
        criteria: new Criteria([
          {
            field: 'tenantId',
            operator: FilterOperator.EQUALS,
            value: authenticatedClient.tenantId,
          },
          {
            field: 'channel',
            operator: FilterOperator.EQUALS,
            value: input.channel,
          },
        ]),
      }),
    );

    return this.notificationChannelDestinationGraphQLMapper.toResponseDtoFromViewModel(
      result.items[0] ?? null,
    );
  }
}
