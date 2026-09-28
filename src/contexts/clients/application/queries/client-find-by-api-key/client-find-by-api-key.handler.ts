import { Logger } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { ClientFindByApiKeyQuery } from '@contexts/clients/application/queries/client-find-by-api-key/client-find-by-api-key.query';
import { AuthenticatedClientResult } from '@contexts/clients/application/services/write/authenticate-client-api-key/authenticated-client-result.interface';
import { AuthenticateClientApiKeyService } from '@contexts/clients/application/services/write/authenticate-client-api-key/authenticate-client-api-key.service';

/**
 * Thin delegate to `AuthenticateClientApiKeyService` (spec:
 * `client-authentication` "Valid key resolves the client's tenant",
 * rejection scenarios). Logs at entry per convention, WITHOUT the
 * presented key — the key is never logged, on any path (D17, spec "API Key
 * Is Never Logged").
 */
@QueryHandler(ClientFindByApiKeyQuery)
export class ClientFindByApiKeyHandler implements IQueryHandler<
  ClientFindByApiKeyQuery,
  AuthenticatedClientResult | null
> {
  private readonly logger = new Logger(ClientFindByApiKeyHandler.name);

  constructor(
    private readonly authenticateClientApiKeyService: AuthenticateClientApiKeyService,
  ) {}

  async execute(
    query: ClientFindByApiKeyQuery,
  ): Promise<AuthenticatedClientResult | null> {
    this.logger.log('Authenticating client by API key');
    return this.authenticateClientApiKeyService.execute(query.apiKey);
  }
}
