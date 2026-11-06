import { ExecutionContext } from '@nestjs/common';

import { IAuthenticatedClient } from '@contexts/notifications/application/ports/authenticated-client.interface';
import { extractCurrentClient } from '@contexts/notifications/infrastructure/decorators/current-client.decorator';

const AUTHENTICATED_CLIENT: IAuthenticatedClient = {
  clientId: 'client-1',
  tenantId: 'tenant-1',
};

function createHttpContext(
  authenticatedClient: IAuthenticatedClient,
): ExecutionContext {
  const request = { authenticatedClient };
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function createGraphqlContext(
  authenticatedClient: IAuthenticatedClient,
): ExecutionContext {
  const request = { authenticatedClient };
  return {
    getType: () => 'graphql',
    getArgs: () => [{}, {}, { req: request }, {}],
    getClass: () => class Fixture {},
    getHandler: () => (): undefined => undefined,
  } as unknown as ExecutionContext;
}

describe('extractCurrentClient', () => {
  it('reads authenticatedClient from an HTTP request set by ClientApiKeyGuard', () => {
    const result = extractCurrentClient(
      undefined,
      createHttpContext(AUTHENTICATED_CLIENT),
    );

    expect(result).toEqual(AUTHENTICATED_CLIENT);
  });

  it('reads authenticatedClient from a GraphQL request set by ClientApiKeyGuard', () => {
    const result = extractCurrentClient(
      undefined,
      createGraphqlContext(AUTHENTICATED_CLIENT),
    );

    expect(result).toEqual(AUTHENTICATED_CLIENT);
  });

  it('returns the exact tenantId resolved for a different client, proving no hardcoded value', () => {
    const other: IAuthenticatedClient = {
      clientId: 'client-2',
      tenantId: 'tenant-2',
    };

    const result = extractCurrentClient(undefined, createHttpContext(other));

    expect(result).toEqual(other);
  });
});
