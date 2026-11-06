import { BaseEvent, IEventMetadata } from '@sisques-labs/nestjs-kit';

import { IClientEventData } from '@contexts/clients/domain/events/interfaces/client-event-data.interface';

export class ClientRevokedEvent extends BaseEvent<IClientEventData> {
  constructor(metadata: IEventMetadata, data: IClientEventData) {
    super(metadata, data);
  }
}
