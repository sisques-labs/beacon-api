import { Criteria } from '@sisques-labs/nestjs-kit';

export interface NotificationFindByCriteriaQueryInput {
  criteria: Criteria;
}

export class NotificationFindByCriteriaQuery {
  public readonly criteria: Criteria;

  constructor(input: NotificationFindByCriteriaQueryInput) {
    this.criteria = input.criteria;
  }
}
