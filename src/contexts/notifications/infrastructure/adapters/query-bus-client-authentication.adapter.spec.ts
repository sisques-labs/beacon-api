import { QueryBus } from '@nestjs/cqrs';
import { Mocked, vi } from 'vitest';

import { ClientFindByApiKeyQuery } from '@contexts/clients/application/queries/client-find-by-api-key/client-find-by-api-key.query';
import { QueryBusClientAuthenticationAdapter } from '@contexts/notifications/infrastructure/adapters/query-bus-client-authentication.adapter';

describe('QueryBusClientAuthenticationAdapter', () => {
  let adapter: QueryBusClientAuthenticationAdapter;
  let queryBus: Mocked<QueryBus>;

  beforeEach(() => {
    queryBus = { execute: vi.fn() } as unknown as Mocked<QueryBus>;
    adapter = new QueryBusClientAuthenticationAdapter(queryBus);
  });

  it('dispatches ClientFindByApiKeyQuery and maps a resolved client to IAuthenticatedClient', async () => {
    queryBus.execute.mockResolvedValue({
      clientId: 'client-1',
      tenantId: 'tenant-1',
    });

    const result = await adapter.authenticate('bcn_key_secret');

    expect(queryBus.execute).toHaveBeenCalledWith(
      new ClientFindByApiKeyQuery({ apiKey: 'bcn_key_secret' }),
    );
    expect(result).toEqual({ clientId: 'client-1', tenantId: 'tenant-1' });
  });

  it('maps a null resolution (missing/invalid/revoked) to null', async () => {
    queryBus.execute.mockResolvedValue(null);

    const result = await adapter.authenticate('bcn_bad_key');

    expect(result).toBeNull();
  });

  it('returns null without dispatching when the credential is undefined', async () => {
    const result = await adapter.authenticate(undefined);

    expect(result).toBeNull();
    expect(queryBus.execute).not.toHaveBeenCalled();
  });
});
