import { Inject, Logger } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PaginatedResult } from '@sisques-labs/nestjs-kit';

import { NotificationChannelDestinationFindByCriteriaQuery } from '@contexts/notifications/application/queries/notification-channel-destination-find-by-criteria/notification-channel-destination-find-by-criteria.query';
import {
  INotificationChannelDestinationReadRepository,
  NOTIFICATION_CHANNEL_DESTINATION_READ_REPOSITORY,
} from '@contexts/notifications/domain/repositories/read/notification-channel-destination-read.repository';
import { NotificationChannelDestinationViewModel } from '@contexts/notifications/domain/view-models/notification-channel-destination.view-model';

/**
 * Single list/lookup entry point for destination metadata (for example a
 * `(tenantId, channel)` lookup is `tenantId = ? AND channel = ?`). The read
 * repository rejects filters/sorts outside its allowlist, so this handler
 * only delegates.
 */
@QueryHandler(NotificationChannelDestinationFindByCriteriaQuery)
export class NotificationChannelDestinationFindByCriteriaHandler implements IQueryHandler<
  NotificationChannelDestinationFindByCriteriaQuery,
  PaginatedResult<NotificationChannelDestinationViewModel>
> {
  private readonly logger = new Logger(
    NotificationChannelDestinationFindByCriteriaHandler.name,
  );

  constructor(
    @Inject(NOTIFICATION_CHANNEL_DESTINATION_READ_REPOSITORY)
    private readonly readRepository: INotificationChannelDestinationReadRepository,
  ) {}

  async execute(
    query: NotificationChannelDestinationFindByCriteriaQuery,
  ): Promise<PaginatedResult<NotificationChannelDestinationViewModel>> {
    this.logger.log(
      `Finding notification channel destinations by criteria: ${JSON.stringify(query.criteria)}`,
    );
    return this.readRepository.findByCriteria(query.criteria);
  }
}
