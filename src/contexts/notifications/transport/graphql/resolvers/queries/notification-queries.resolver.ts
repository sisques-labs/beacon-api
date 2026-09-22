import { Logger } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { Args, Query, Resolver } from '@nestjs/graphql';
import { Criteria, PaginatedResult } from '@sisques-labs/nestjs-kit';
import { FilterValidationPipe } from '@sisques-labs/nestjs-kit/graphql';

import { NotificationFindByCriteriaQuery } from '@contexts/notifications/application/queries/notification-find-by-criteria/notification-find-by-criteria.query';
import { NotificationFindByIdQuery } from '@contexts/notifications/application/queries/notification-find-by-id/notification-find-by-id.query';
import { NotificationViewModel } from '@contexts/notifications/domain/view-models/notification.view-model';
import { notificationFilterableFields } from '@contexts/notifications/transport/graphql/registries/notification-filterable-fields.registry';
import { NotificationFindByCriteriaRequestDto } from '@contexts/notifications/transport/graphql/dtos/requests/notification-find-by-criteria.request.dto';
import { NotificationFindByIdRequestDto } from '@contexts/notifications/transport/graphql/dtos/requests/notification-find-by-id.request.dto';
import { NotificationPaginatedResponseDto } from '@contexts/notifications/transport/graphql/dtos/responses/notification-paginated.response.dto';
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
  ): Promise<NotificationResponseDto> {
    this.logger.log(`GraphQL notificationFindById(${input.id})`);

    const viewModel = await this.queryBus.execute<
      NotificationFindByIdQuery,
      NotificationViewModel
    >(new NotificationFindByIdQuery({ id: input.id }));

    return this.notificationGraphQLMapper.toResponseDtoFromViewModel(viewModel);
  }

  @Query(() => NotificationPaginatedResponseDto, {
    name: 'notificationsFindByCriteria',
    description:
      'List notifications matching the given filters, sorts, and pagination.',
  })
  async notificationsFindByCriteria(
    @Args(
      'input',
      { nullable: true },
      new FilterValidationPipe(notificationFilterableFields),
    )
    input?: NotificationFindByCriteriaRequestDto,
  ): Promise<NotificationPaginatedResponseDto> {
    this.logger.log('GraphQL notificationsFindByCriteria');

    const criteria = new Criteria(
      input?.filters,
      input?.sorts,
      input?.pagination,
    );

    const paginatedResult = await this.queryBus.execute<
      NotificationFindByCriteriaQuery,
      PaginatedResult<NotificationViewModel>
    >(new NotificationFindByCriteriaQuery({ criteria }));

    return this.notificationGraphQLMapper.toPaginatedResponseDtoFromPaginatedResult(
      paginatedResult,
    );
  }
}
