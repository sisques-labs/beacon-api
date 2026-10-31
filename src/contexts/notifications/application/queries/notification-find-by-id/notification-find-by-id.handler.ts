import { Logger } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { NotificationFindByIdQuery } from '@contexts/notifications/application/queries/notification-find-by-id/notification-find-by-id.query';
import { AssertNotificationViewModelExistsService } from '@contexts/notifications/application/services/read/assert-notification-view-model-exists/assert-notification-view-model-exists.service';
import { NotificationNotFoundException } from '@contexts/notifications/domain/exceptions/notification-not-found.exception';
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

  /**
   * D25: a notification that exists but belongs to a different tenant is
   * treated exactly like a nonexistent one — the same
   * `NotificationNotFoundException` (404), never a 403 — so the response
   * never reveals that the id exists under another tenant. The tenant
   * comparison stays here rather than in the generic, id-only
   * `AssertNotificationViewModelExistsService` (or the kit's
   * `IBaseReadRepository.findById(id)`, which takes no tenant filter), so
   * that shared existence-check utility keeps its single, reusable
   * responsibility.
   */
  async execute(
    query: NotificationFindByIdQuery,
  ): Promise<NotificationViewModel> {
    this.logger.log(`Finding notification by id ${query.id.value}`);
    const viewModel =
      await this.assertNotificationViewModelExistsService.execute(
        query.id.value,
      );
    if (viewModel.tenantId !== query.tenantId.value) {
      throw new NotificationNotFoundException(query.id.value);
    }
    return viewModel;
  }
}
