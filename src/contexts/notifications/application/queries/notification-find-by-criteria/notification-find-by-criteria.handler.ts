import { Inject, Logger } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PaginatedResult } from '@sisques-labs/nestjs-kit';

import { NotificationFindByCriteriaQuery } from '@contexts/notifications/application/queries/notification-find-by-criteria/notification-find-by-criteria.query';
import {
  INotificationReadRepository,
  NOTIFICATION_READ_REPOSITORY,
} from '@contexts/notifications/domain/repositories/read/notification-read.repository';
import { NotificationViewModel } from '@contexts/notifications/domain/view-models/notification.view-model';

@QueryHandler(NotificationFindByCriteriaQuery)
export class NotificationFindByCriteriaHandler implements IQueryHandler<
  NotificationFindByCriteriaQuery,
  PaginatedResult<NotificationViewModel>
> {
  private readonly logger = new Logger(NotificationFindByCriteriaHandler.name);

  constructor(
    @Inject(NOTIFICATION_READ_REPOSITORY)
    private readonly readRepository: INotificationReadRepository,
  ) {}

  async execute(
    query: NotificationFindByCriteriaQuery,
  ): Promise<PaginatedResult<NotificationViewModel>> {
    this.logger.log('Finding notifications by criteria');
    return this.readRepository.findByCriteria(query.criteria);
  }
}
