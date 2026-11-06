import { BaseEvent, IEventMetadata } from '@sisques-labs/nestjs-kit';

import { INotificationChannelDestinationEventData } from '@contexts/notifications/domain/events/interfaces/notification-channel-destination-event-data.interface';

export class NotificationChannelDestinationRotatedEvent extends BaseEvent<INotificationChannelDestinationEventData> {
  constructor(
    metadata: IEventMetadata,
    data: INotificationChannelDestinationEventData,
  ) {
    super(metadata, data);
  }
}
