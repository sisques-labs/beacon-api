import { Mocked, vi } from 'vitest';

import { ClientFindByApiKeyHandler } from '@contexts/clients/application/queries/client-find-by-api-key/client-find-by-api-key.handler';
import { ClientFindByApiKeyQuery } from '@contexts/clients/application/queries/client-find-by-api-key/client-find-by-api-key.query';
import { AuthenticateClientApiKeyService } from '@contexts/clients/application/services/write/authenticate-client-api-key/authenticate-client-api-key.service';

const RESULT = {
  clientId: '11111111-1111-4111-8111-111111111111',
  tenantId: '22222222-2222-4222-8222-222222222222',
};

describe('ClientFindByApiKeyHandler', () => {
  let handler: ClientFindByApiKeyHandler;
  let authenticateClientApiKeyService: Mocked<AuthenticateClientApiKeyService>;

  beforeEach(() => {
    authenticateClientApiKeyService = {
      execute: vi.fn(),
    } as unknown as Mocked<AuthenticateClientApiKeyService>;
    handler = new ClientFindByApiKeyHandler(authenticateClientApiKeyService);
  });

  it('delegates to AuthenticateClientApiKeyService with the query apiKey and returns its result', async () => {
    authenticateClientApiKeyService.execute.mockResolvedValue(RESULT);
    const query = new ClientFindByApiKeyQuery({ apiKey: 'bcn_valid_key' });

    const result = await handler.execute(query);

    expect(authenticateClientApiKeyService.execute).toHaveBeenCalledWith(
      'bcn_valid_key',
    );
    expect(result).toBe(RESULT);
  });

  it('returns null for a missing, invalid, or revoked key', async () => {
    authenticateClientApiKeyService.execute.mockResolvedValue(null);
    const query = new ClientFindByApiKeyQuery({ apiKey: 'not-a-key' });

    const result = await handler.execute(query);

    expect(result).toBeNull();
  });
});
