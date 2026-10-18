import { UuidValueObject } from '@sisques-labs/nestjs-kit';

export interface RevokeClientCommandInput {
  clientId: string;
}

/**
 * Wraps `clientId` in a `UuidValueObject`. Revocation loads the client by
 * this id, so no `tenantId` is needed here — the handler reads it off the
 * loaded aggregate.
 */
export class RevokeClientCommand {
  public readonly clientId: UuidValueObject;

  constructor(input: RevokeClientCommandInput) {
    this.clientId = new UuidValueObject(input.clientId);
  }
}
