import { Mocked, vi } from 'vitest';

import { ClientsFindAllHandler } from '@contexts/clients/application/queries/clients-find-all/clients-find-all.handler';
import { ClientsFindAllQuery } from '@contexts/clients/application/queries/clients-find-all/clients-find-all.query';
import { IClientReadRepository } from '@contexts/clients/domain/repositories/read/client-read.repository';
import { ClientViewModel } from '@contexts/clients/domain/view-models/client.view-model';

function buildViewModel(
  overrides: Partial<{ id: string; name: string }> = {},
): ClientViewModel {
  return new ClientViewModel({
    id: overrides.id ?? '11111111-1111-4111-8111-111111111111',
    tenantId: '22222222-2222-4222-8222-222222222222',
    name: overrides.name ?? 'Acme Inc.',
    apiKeyId: 'a1b2c3d4e5f60718',
    apiKeyRotatedAt: null,
    revokedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  });
}

describe('ClientsFindAllHandler', () => {
  let handler: ClientsFindAllHandler;
  let readRepository: Mocked<IClientReadRepository>;

  beforeEach(() => {
    readRepository = {
      findAll: vi.fn(),
    } as unknown as Mocked<IClientReadRepository>;
    handler = new ClientsFindAllHandler(readRepository);
  });

  it('delegates to the read repository and returns every client', async () => {
    const clients = [
      buildViewModel({ id: '11111111-1111-4111-8111-111111111111' }),
      buildViewModel({
        id: '33333333-3333-4333-8333-333333333333',
        name: 'Beta Corp.',
      }),
    ];
    readRepository.findAll.mockResolvedValue(clients);

    const result = await handler.execute(new ClientsFindAllQuery());

    expect(readRepository.findAll).toHaveBeenCalledWith();
    expect(result).toBe(clients);
    expect(result).toHaveLength(2);
  });

  it('returns an empty array when no clients exist', async () => {
    readRepository.findAll.mockResolvedValue([]);

    const result = await handler.execute(new ClientsFindAllQuery());

    expect(result).toEqual([]);
  });

  it('never exposes apiKeySecretHash on any returned client', async () => {
    const clients = [buildViewModel()];
    readRepository.findAll.mockResolvedValue(clients);

    const result = await handler.execute(new ClientsFindAllQuery());

    expect(JSON.stringify(result)).not.toContain('apiKeySecretHash');
  });
});
