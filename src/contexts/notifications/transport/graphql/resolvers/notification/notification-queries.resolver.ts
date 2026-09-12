import { Logger } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { Args, Query, Resolver } from '@nestjs/graphql';

import { NotificationFindByIdQuery } from '@contexts/notifications/application/queries/notification-find-by-id/notification-find-by-id.query';
import { NotificationViewModel } from '@contexts/notifications/domain/view-models/notification.view-model';
import { NotificationFindByIdRequestDto } from '@contexts/notifications/transport/graphql/dtos/requests/notification/notification-find-by-id.request.dto';
import { NotificationResponseDto } from '@contexts/notifications/transport/graphql/dtos/responses/notification/notification.response.dto';
import { NotificationGraphQLMapper } from '@contexts/notifications/transport/graphql/mappers/notification/notification.mapper';

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
  ): Promise<NotificationResponseDto> {
    this.logger.log(`GraphQL notificationFindById(${input.id})`);

    const viewModel = await this.queryBus.execute<
      NotificationFindByIdQuery,
      NotificationViewModel
    >(new NotificationFindByIdQuery({ id: input.id }));

    return this.notificationGraphQLMapper.toResponseDtoFromViewModel(viewModel);
  }
}
