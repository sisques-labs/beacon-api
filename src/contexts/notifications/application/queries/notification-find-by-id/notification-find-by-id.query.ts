import { UuidValueObject } from '@sisques-labs/nestjs-kit';

export interface NotificationFindByIdQueryInput {
  id: string;
}

export class NotificationFindByIdQuery {
  public readonly id: UuidValueObject;

  constructor(input: NotificationFindByIdQueryInput) {
    this.id = new UuidValueObject(input.id);
  }
}
