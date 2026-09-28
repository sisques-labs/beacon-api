import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Request } from 'express';

import { IAuthenticatedClient } from '@contexts/notifications/application/ports/authenticated-client.interface';
import {
  CLIENT_AUTHENTICATION_PORT,
  IClientAuthenticationPort,
} from '@contexts/notifications/application/ports/client-authentication.port';

const API_KEY_HEADER = 'x-api-key';

export type AuthenticatedClientRequest = Request & {
  authenticatedClient?: IAuthenticatedClient;
};

/**
 * Class-level guard (design.md D21) authenticating both HTTP and GraphQL
 * requests through `IClientAuthenticationPort`. Reads the `x-api-key`
 * header, resolves the client, and sets `request.authenticatedClient` for
 * `@CurrentClient()` to read. Every rejection reason (missing, malformed,
 * unknown, or revoked key — D17) surfaces as the same fixed-text
 * `UnauthorizedException`, and the presented key never reaches it or any
 * log call.
 */
@Injectable()
export class ClientApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ClientApiKeyGuard.name);

  constructor(
    @Inject(CLIENT_AUTHENTICATION_PORT)
    private readonly clientAuthenticationPort: IClientAuthenticationPort,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = getAuthenticatedClientRequest(context);
    const credential = readApiKeyHeader(request);

    const authenticatedClient =
      await this.clientAuthenticationPort.authenticate(credential);
    if (!authenticatedClient) {
      this.logger.warn('Rejected request: invalid or missing API key');
      throw new UnauthorizedException('Invalid API key');
    }

    request.authenticatedClient = authenticatedClient;
    return true;
  }
}

export function getAuthenticatedClientRequest(
  context: ExecutionContext,
): AuthenticatedClientRequest {
  if (context.getType<'graphql'>() === 'graphql') {
    return GqlExecutionContext.create(context).getContext<{
      req: AuthenticatedClientRequest;
    }>().req;
  }
  return context.switchToHttp().getRequest<AuthenticatedClientRequest>();
}

function readApiKeyHeader(
  request: AuthenticatedClientRequest,
): string | undefined {
  const rawValue = request.headers[API_KEY_HEADER];
  return Array.isArray(rawValue) ? rawValue[0] : rawValue;
}
