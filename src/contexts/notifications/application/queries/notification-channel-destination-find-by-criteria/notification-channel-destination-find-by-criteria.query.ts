import { Criteria } from '@sisques-labs/nestjs-kit';

export interface NotificationChannelDestinationFindByCriteriaQueryInput {
  criteria: Criteria;
}

export class NotificationChannelDestinationFindByCriteriaQuery {
  public readonly criteria: Criteria;

  constructor(input: NotificationChannelDestinationFindByCriteriaQueryInput) {
    this.criteria = input.criteria;
  }
}
