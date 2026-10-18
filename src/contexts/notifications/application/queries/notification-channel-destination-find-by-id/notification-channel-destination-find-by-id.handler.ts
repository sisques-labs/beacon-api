import { Inject, Logger } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { NotificationChannelDestinationFindByIdQuery } from '@contexts/notifications/application/queries/notification-channel-destination-find-by-id/notification-channel-destination-find-by-id.query';
import {
  INotificationChannelDestinationReadRepository,
  NOTIFICATION_CHANNEL_DESTINATION_READ_REPOSITORY,
} from '@contexts/notifications/domain/repositories/read/notification-channel-destination-read.repository';
import { NotificationChannelDestinationViewModel } from '@contexts/notifications/domain/view-models/notification-channel-destination.view-model';

/**
 * Metadata-only read (spec: "Metadata-Only Reads"): the view model never
 * carries the envelope. An unknown id resolves to `null` instead of throwing,
 * so transport decides how to present "not found".
 */
@QueryHandler(NotificationChannelDestinationFindByIdQuery)
export class NotificationChannelDestinationFindByIdHandler implements IQueryHandler<
  NotificationChannelDestinationFindByIdQuery,
  NotificationChannelDestinationViewModel | null
> {
  private readonly logger = new Logger(
    NotificationChannelDestinationFindByIdHandler.name,
  );

  constructor(
    @Inject(NOTIFICATION_CHANNEL_DESTINATION_READ_REPOSITORY)
    private readonly readRepository: INotificationChannelDestinationReadRepository,
  ) {}

  async execute(
    query: NotificationChannelDestinationFindByIdQuery,
  ): Promise<NotificationChannelDestinationViewModel | null> {
    this.logger.log(
      `Finding notification channel destination by id ${query.id.value}`,
    );
    return this.readRepository.findById(query.id.value);
  }
}
