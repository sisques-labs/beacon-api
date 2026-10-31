import { UuidValueObject } from '@sisques-labs/nestjs-kit';

export interface NotificationFindByIdQueryInput {
  id: string;
  tenantId: string;
}

/**
 * D25: `tenantId` is the authenticated client's own tenant (never a
 * caller-supplied value). The handler compares it against the found
 * notification's `tenantId` and returns not-found — never forbidden — on a
 * mismatch, so the response never reveals that the id exists under another
 * tenant.
 */
export class NotificationFindByIdQuery {
  public readonly id: UuidValueObject;
  public readonly tenantId: UuidValueObject;

  constructor(input: NotificationFindByIdQueryInput) {
    this.id = new UuidValueObject(input.id);
    this.tenantId = new UuidValueObject(input.tenantId);
  }
}
