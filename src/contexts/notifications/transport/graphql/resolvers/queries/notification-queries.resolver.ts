import { Logger, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { Args, Query, Resolver } from '@nestjs/graphql';

import { NotificationFindByIdQuery } from '@contexts/notifications/application/queries/notification-find-by-id/notification-find-by-id.query';
import { IAuthenticatedClient } from '@contexts/notifications/application/ports/authenticated-client.interface';
import { NotificationViewModel } from '@contexts/notifications/domain/view-models/notification.view-model';
import { CurrentClient } from '@contexts/notifications/infrastructure/decorators/current-client.decorator';
import { ClientApiKeyGuard } from '@contexts/notifications/infrastructure/guards/client-api-key.guard';
import { NotificationFindByIdRequestDto } from '@contexts/notifications/transport/graphql/dtos/requests/notification-find-by-id.request.dto';
import { NotificationResponseDto } from '@contexts/notifications/transport/graphql/dtos/responses/notification.response.dto';
import { NotificationGraphQLMapper } from '@contexts/notifications/transport/graphql/mappers/notification.mapper';

/**
 * Phase B (design.md D21/D25): class-level `@UseGuards(ClientApiKeyGuard)`
 * — this is the last class removed from the Phase A allowlist
 * (`NOTIFICATIONS_PHASE_A_GUARD_ALLOWLIST`, now empty). The read is scoped
 * to the authenticated client's own tenant via `@CurrentClient()`; a
 * notification belonging to another tenant returns 404, never 403 (D25).
 */
@Resolver()
@UseGuards(ClientApiKeyGuard)
export class NotificationQueriesResolver {
  private readonly logger = new Logger(NotificationQueriesResolver.name);

  constructor(
    private readonly queryBus: QueryBus,
    private readonly notificationGraphQLMapper: NotificationGraphQLMapper,
  ) {}

  @Query(() => NotificationResponseDto, {
    name: 'notificationFindById',
    description: "Get a single notification's current state by id.",
  })
  async notificationFindById(
    @Args('input') input: NotificationFindByIdRequestDto,
    @CurrentClient() authenticatedClient: IAuthenticatedClient,
  ): Promise<NotificationResponseDto> {
    this.logger.log(
      `GraphQL notificationFindById(${input.id}) tenant=${authenticatedClient.tenantId}`,
    );

    const viewModel = await this.queryBus.execute<
      NotificationFindByIdQuery,
      NotificationViewModel
    >(
      new NotificationFindByIdQuery({
        id: input.id,
        tenantId: authenticatedClient.tenantId,
      }),
    );

    return this.notificationGraphQLMapper.toResponseDtoFromViewModel(viewModel);
  }
}
