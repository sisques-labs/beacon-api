import { ClientFindByApiKeyQuery } from '@contexts/clients/application/queries/client-find-by-api-key/client-find-by-api-key.query';

describe('ClientFindByApiKeyQuery', () => {
  it('carries the presented apiKey as-is', () => {
    const query = new ClientFindByApiKeyQuery({ apiKey: 'bcn_deadbeef' });

    expect(query.apiKey).toBe('bcn_deadbeef');
  });

  it('never throws for a malformed apiKey (D17 — resolves to null, not an exception)', () => {
    expect(
      () => new ClientFindByApiKeyQuery({ apiKey: 'not-a-key' }),
    ).not.toThrow();
    expect(() => new ClientFindByApiKeyQuery({ apiKey: '' })).not.toThrow();
  });
});
