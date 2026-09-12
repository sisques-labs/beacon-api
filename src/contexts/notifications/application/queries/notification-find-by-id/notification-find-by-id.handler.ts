import { Logger } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { NotificationFindByIdQuery } from '@contexts/notifications/application/queries/notification-find-by-id/notification-find-by-id.query';
import { AssertNotificationViewModelExistsService } from '@contexts/notifications/application/services/read/assert-notification-view-model-exists.service';
import { NotificationViewModel } from '@contexts/notifications/domain/view-models/notification.view-model';

@QueryHandler(NotificationFindByIdQuery)
export class NotificationFindByIdHandler implements IQueryHandler<
  NotificationFindByIdQuery,
  NotificationViewModel
> {
  private readonly logger = new Logger(NotificationFindByIdHandler.name);

  constructor(
    private readonly assertNotificationViewModelExistsService: AssertNotificationViewModelExistsService,
  ) {}

  async execute(
    query: NotificationFindByIdQuery,
  ): Promise<NotificationViewModel> {
    this.logger.log(`Finding notification by id ${query.id.value}`);
    return this.assertNotificationViewModelExistsService.execute(
      query.id.value,
    );
  }
}
