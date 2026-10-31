import { UuidValueObject } from '@sisques-labs/nestjs-kit';

export interface RotateClientApiKeyCommandInput {
  clientId: string;
}

/**
 * Wraps `clientId` in a `UuidValueObject`. Rotation loads the client by
 * this id, so no `tenantId` is needed here — the handler reads it off the
 * loaded aggregate.
 */
export class RotateClientApiKeyCommand {
  public readonly clientId: UuidValueObject;

  constructor(input: RotateClientApiKeyCommandInput) {
    this.clientId = new UuidValueObject(input.clientId);
  }
}
