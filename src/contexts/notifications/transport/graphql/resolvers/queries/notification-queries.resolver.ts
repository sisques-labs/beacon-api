import { Logger } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { Args, Context, Query, Resolver } from '@nestjs/graphql';
import { Request } from 'express';

import { NotificationFindByIdQuery } from '@contexts/notifications/application/queries/notification-find-by-id/notification-find-by-id.query';
import { NotificationViewModel } from '@contexts/notifications/domain/view-models/notification.view-model';
import {
  readApiKeyHeaderValue,
  warnIfApiKeyMissing,
} from '@contexts/notifications/infrastructure/logging/api-key-readiness-warning';
import { NotificationFindByIdRequestDto } from '@contexts/notifications/transport/graphql/dtos/requests/notification-find-by-id.request.dto';
import { NotificationResponseDto } from '@contexts/notifications/transport/graphql/dtos/responses/notification.response.dto';
import { NotificationGraphQLMapper } from '@contexts/notifications/transport/graphql/mappers/notification.mapper';

@Resolver()
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
    @Context() context: { req: Request },
  ): Promise<NotificationResponseDto> {
    this.logger.log(`GraphQL notificationFindById(${input.id})`);
    // Phase A readiness warning (design.md D13/27.1) — this query stays
    // unguarded until Phase B, so there is no authenticated tenantId to
    // report here yet.
    warnIfApiKeyMissing(
      this.logger,
      readApiKeyHeaderValue(context.req.headers),
    );

    const viewModel = await this.queryBus.execute<
      NotificationFindByIdQuery,
      NotificationViewModel
    >(new NotificationFindByIdQuery({ id: input.id }));

    return this.notificationGraphQLMapper.toResponseDtoFromViewModel(viewModel);
  }
}
