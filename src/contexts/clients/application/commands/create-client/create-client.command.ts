import { UuidValueObject } from '@sisques-labs/nestjs-kit';

import { ClientNameValueObject } from '@contexts/clients/domain/value-objects/client-name/client-name.value-object';

export interface CreateClientCommandInput {
  name: string;
  tenantId?: string;
}

/**
 * Wraps `name` in its value object and `tenantId` in a `UuidValueObject`
 * (design.md D20's `--tenant-id` flag). When `tenantId` is omitted, a fresh
 * one is generated, so every CLI-created client still maps 1:1 to a
 * `tenantId` (D15) without the operator having to mint one up front.
 */
export class CreateClientCommand {
  public readonly name: ClientNameValueObject;
  public readonly tenantId: UuidValueObject;

  constructor(input: CreateClientCommandInput) {
    this.name = new ClientNameValueObject(input.name);
    this.tenantId = new UuidValueObject(
      input.tenantId ?? UuidValueObject.generate().value,
    );
  }
}
