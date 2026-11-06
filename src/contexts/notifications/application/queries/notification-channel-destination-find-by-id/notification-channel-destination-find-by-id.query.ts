import { UuidValueObject } from '@sisques-labs/nestjs-kit';

export interface NotificationChannelDestinationFindByIdQueryInput {
  id: string;
}

export class NotificationChannelDestinationFindByIdQuery {
  public readonly id: UuidValueObject;

  constructor(input: NotificationChannelDestinationFindByIdQueryInput) {
    this.id = new UuidValueObject(input.id);
  }
}
