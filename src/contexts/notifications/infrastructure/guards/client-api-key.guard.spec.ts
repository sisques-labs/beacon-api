import {
  ExecutionContext,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Mocked, vi } from 'vitest';

import { IAuthenticatedClient } from '@contexts/notifications/application/ports/authenticated-client.interface';
import { IClientAuthenticationPort } from '@contexts/notifications/application/ports/client-authentication.port';
import { ClientApiKeyGuard } from '@contexts/notifications/infrastructure/guards/client-api-key.guard';

const VALID_KEY =
  'bcn_129a5a9012345678_secretsecretsecretsecretsecretsecretsecret';
const AUTHENTICATED_CLIENT: IAuthenticatedClient = {
  clientId: 'client-1',
  tenantId: 'tenant-1',
};

function createHttpContext(headers: Record<string, string> = {}): {
  context: ExecutionContext;
  request: {
    headers: Record<string, string>;
    authenticatedClient?: IAuthenticatedClient;
  };
} {
  const request = {
    headers,
    authenticatedClient: undefined as IAuthenticatedClient | undefined,
  };
  const context = {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

function createGraphqlContext(headers: Record<string, string> = {}): {
  context: ExecutionContext;
  request: {
    headers: Record<string, string>;
    authenticatedClient?: IAuthenticatedClient;
  };
} {
  const request = {
    headers,
    authenticatedClient: undefined as IAuthenticatedClient | undefined,
  };
  const context = {
    getType: () => 'graphql',
    getArgs: () => [{}, {}, { req: request }, {}],
    getClass: () => class Fixture {},
    getHandler: () => (): undefined => undefined,
  } as unknown as ExecutionContext;
  return { context, request };
}

describe('ClientApiKeyGuard', () => {
  let clientAuthenticationPort: Mocked<IClientAuthenticationPort>;
  let guard: ClientApiKeyGuard;

  beforeEach(() => {
    clientAuthenticationPort = {
      authenticate: vi.fn(),
    } as unknown as Mocked<IClientAuthenticationPort>;
    guard = new ClientApiKeyGuard(clientAuthenticationPort);
  });

  it('activates an HTTP request presenting a valid x-api-key and sets authenticatedClient', async () => {
    clientAuthenticationPort.authenticate.mockResolvedValue(
      AUTHENTICATED_CLIENT,
    );
    const { context, request } = createHttpContext({ 'x-api-key': VALID_KEY });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(clientAuthenticationPort.authenticate).toHaveBeenCalledWith(
      VALID_KEY,
    );
    expect(request.authenticatedClient).toEqual(AUTHENTICATED_CLIENT);
  });

  it('activates a GraphQL request presenting a valid x-api-key and sets authenticatedClient', async () => {
    clientAuthenticationPort.authenticate.mockResolvedValue(
      AUTHENTICATED_CLIENT,
    );
    const { context, request } = createGraphqlContext({
      'x-api-key': VALID_KEY,
    });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(clientAuthenticationPort.authenticate).toHaveBeenCalledWith(
      VALID_KEY,
    );
    expect(request.authenticatedClient).toEqual(AUTHENTICATED_CLIENT);
  });

  it('rejects an HTTP request with a missing x-api-key header with a fixed 401 message', async () => {
    clientAuthenticationPort.authenticate.mockResolvedValue(null);
    const { context } = createHttpContext();

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Invalid API key'),
    );
    expect(clientAuthenticationPort.authenticate).toHaveBeenCalledWith(
      undefined,
    );
  });

  it('rejects an HTTP request with an invalid x-api-key with the same fixed 401 message', async () => {
    clientAuthenticationPort.authenticate.mockResolvedValue(null);
    const { context } = createHttpContext({ 'x-api-key': 'bcn_bad' });

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Invalid API key'),
    );
  });

  it('rejects a GraphQL request with a revoked x-api-key with the same fixed 401 message', async () => {
    clientAuthenticationPort.authenticate.mockResolvedValue(null);
    const { context } = createGraphqlContext({ 'x-api-key': VALID_KEY });

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Invalid API key'),
    );
  });

  it('never logs the presented API key on any success or rejection path', async () => {
    const logSpy = vi
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    const warnSpy = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const errorSpy = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    clientAuthenticationPort.authenticate.mockResolvedValueOnce(
      AUTHENTICATED_CLIENT,
    );
    await guard.canActivate(
      createHttpContext({ 'x-api-key': VALID_KEY }).context,
    );

    clientAuthenticationPort.authenticate.mockResolvedValueOnce(null);
    await expect(
      guard.canActivate(createHttpContext({ 'x-api-key': VALID_KEY }).context),
    ).rejects.toThrow(UnauthorizedException);

    const loggedCalls = [
      ...logSpy.mock.calls,
      ...warnSpy.mock.calls,
      ...errorSpy.mock.calls,
    ].flat();
    for (const call of loggedCalls) {
      const serialized = typeof call === 'string' ? call : JSON.stringify(call);
      expect(serialized).not.toContain(VALID_KEY);
    }
  });
});
