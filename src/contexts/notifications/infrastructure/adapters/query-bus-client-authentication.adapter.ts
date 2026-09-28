import { Injectable } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';

import { ClientFindByApiKeyQuery } from '@contexts/clients/application/queries/client-find-by-api-key/client-find-by-api-key.query';
import { AuthenticatedClientResult } from '@contexts/clients/application/services/write/authenticate-client-api-key/authenticated-client-result.interface';
import { IAuthenticatedClient } from '@contexts/notifications/application/ports/authenticated-client.interface';
import { IClientAuthenticationPort } from '@contexts/notifications/application/ports/client-authentication.port';

/**
 * The only place `notifications` reaches the `clients` context — the
 * anti-corruption seam (design.md D14). Dispatches `ClientFindByApiKeyQuery`
 * over the `QueryBus` and maps its result onto this context's own
 * `IAuthenticatedClient`, never leaking `clients`' application types past
 * this adapter.
 */
@Injectable()
export class QueryBusClientAuthenticationAdapter implements IClientAuthenticationPort {
  constructor(private readonly queryBus: QueryBus) {}

  async authenticate(
    credential: string | undefined,
  ): Promise<IAuthenticatedClient | null> {
    if (!credential) {
      return null;
    }

    const result = await this.queryBus.execute<
      ClientFindByApiKeyQuery,
      AuthenticatedClientResult | null
    >(new ClientFindByApiKeyQuery({ apiKey: credential }));

    if (!result) {
      return null;
    }

    return { clientId: result.clientId, tenantId: result.tenantId };
  }
}
