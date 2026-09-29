import { Inject, Logger } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { NotificationChannelDestinationFindByTenantAndChannelQuery } from '@contexts/notifications/application/queries/notification-channel-destination-find-by-tenant-and-channel/notification-channel-destination-find-by-tenant-and-channel.query';
import {
  INotificationChannelDestinationReadRepository,
  NOTIFICATION_CHANNEL_DESTINATION_READ_REPOSITORY,
} from '@contexts/notifications/domain/repositories/read/notification-channel-destination-read.repository';
import { NotificationChannelDestinationViewModel } from '@contexts/notifications/domain/view-models/notification-channel-destination.view-model';

/**
 * Metadata-only read (spec: "Metadata-Only Reads"). Unlike
 * `NotificationFindByIdHandler`, this query has no assert-exists service: an
 * unregistered `(tenantId, channel)` pair is a valid outcome, not an error —
 * it MUST resolve to `null` so transport (Phase 8) can map it to
 * `configured: false` instead of a 404.
 */
@QueryHandler(NotificationChannelDestinationFindByTenantAndChannelQuery)
export class NotificationChannelDestinationFindByTenantAndChannelHandler implements IQueryHandler<
  NotificationChannelDestinationFindByTenantAndChannelQuery,
  NotificationChannelDestinationViewModel | null
> {
  private readonly logger = new Logger(
    NotificationChannelDestinationFindByTenantAndChannelHandler.name,
  );

  constructor(
    @Inject(NOTIFICATION_CHANNEL_DESTINATION_READ_REPOSITORY)
    private readonly readRepository: INotificationChannelDestinationReadRepository,
  ) {}

  async execute(
    query: NotificationChannelDestinationFindByTenantAndChannelQuery,
  ): Promise<NotificationChannelDestinationViewModel | null> {
    this.logger.log(
      `Finding notification channel destination for tenant ${query.tenantId.value} channel ${query.channel.value}`,
    );
    return this.readRepository.findByTenantAndChannel(
      query.tenantId.value,
      query.channel.value,
    );
  }
}
