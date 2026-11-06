import { randomUUID } from 'crypto';

import { INestApplication } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';

import { CreateClientResult } from '@contexts/clients/application/commands/create-client/create-client-result.interface';
import { CreateClientCommand } from '@contexts/clients/application/commands/create-client/create-client.command';
import { RevokeClientCommand } from '@contexts/clients/application/commands/revoke-client/revoke-client.command';

/**
 * Seeds a `clients` row through `CommandBus.execute(CreateClientCommand)`,
 * exactly as design.md's E2E strategy requires ("Keys are seeded through
 * `CreateClientCommand`") — never by touching the write repository or
 * TypeORM directly, so the full command-handler path (key generation,
 * hashing, aggregate creation) runs for every seeded client.
 */
export async function seedClient(
  app: INestApplication,
  overrides: { name?: string; tenantId?: string } = {},
): Promise<CreateClientResult> {
  const commandBus = app.get(CommandBus);

  return commandBus.execute<CreateClientCommand, CreateClientResult>(
    new CreateClientCommand({
      name: overrides.name ?? `e2e-client-${randomUUID()}`,
      tenantId: overrides.tenantId,
    }),
  );
}

/** Revokes a previously seeded client through `RevokeClientCommand`. */
export async function revokeClient(
  app: INestApplication,
  clientId: string,
): Promise<void> {
  const commandBus = app.get(CommandBus);

  await commandBus.execute<RevokeClientCommand, void>(
    new RevokeClientCommand({ clientId }),
  );
}
