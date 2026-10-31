import { ExecutionContext, createParamDecorator } from '@nestjs/common';

import { IAuthenticatedClient } from '@contexts/notifications/application/ports/authenticated-client.interface';
import { getAuthenticatedClientRequest } from '@contexts/notifications/infrastructure/guards/client-api-key.guard';

/**
 * Reads `IAuthenticatedClient` from the request `ClientApiKeyGuard` already
 * populated (design.md D21). Every handler using this decorator MUST also
 * carry `@UseGuards(ClientApiKeyGuard)` — the guard's reflection spec
 * (`client-api-key-guard.reflection.spec.ts`) enforces that class-level
 * pairing across `notifications/transport/`.
 */
export function extractCurrentClient(
  _data: unknown,
  context: ExecutionContext,
): IAuthenticatedClient {
  return getAuthenticatedClientRequest(context)
    .authenticatedClient as IAuthenticatedClient;
}

export const CurrentClient = createParamDecorator(extractCurrentClient);
