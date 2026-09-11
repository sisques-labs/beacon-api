import { Logger } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { Args, ID, Query, Resolver } from '@nestjs/graphql';

import { NotificationFindByIdQuery } from '@contexts/notifications/application/queries/notification-find-by-id/notification-find-by-id.query';
import { NotificationViewModel } from '@contexts/notifications/domain/view-models/notification.view-model';
import { NotificationGraphqlMapper } from '@contexts/notifications/transport/graphql/mappers/notification.mapper';
import { NotificationObject } from '@contexts/notifications/transport/graphql/objects/notification.object';

@Resolver(() => NotificationObject)
export class NotificationResolver {
  private readonly logger = new Logger(NotificationResolver.name);

  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: NotificationGraphqlMapper,
  ) {}

  @Query(() => NotificationObject, {
    name: 'notificationFindById',
    description: "Get a single notification's current state by id.",
  })
  async notificationFindById(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<NotificationObject> {
    this.logger.log(`GraphQL notificationFindById(${id})`);
    const viewModel = await this.queryBus.execute<
      NotificationFindByIdQuery,
      NotificationViewModel
    >(new NotificationFindByIdQuery({ id }));
    return this.mapper.toObject(viewModel);
  }
}
