import { EventBus } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { Mocked, vi } from 'vitest';

import { RevokeClientCommand } from '@contexts/clients/application/commands/revoke-client/revoke-client.command';
import { RevokeClientCommandHandler } from '@contexts/clients/application/commands/revoke-client/revoke-client.handler';
import { ClientBuilder } from '@contexts/clients/domain/builders/client.builder';
import { ClientNotFoundException } from '@contexts/clients/domain/exceptions/client-not-found.exception';
import { ClientRevokedException } from '@contexts/clients/domain/exceptions/client-revoked.exception';
import { IClientWriteRepository } from '@contexts/clients/domain/repositories/write/client-write.repository';

const CLIENT_ID = '11111111-1111-4111-8111-111111111111';
const TENANT_ID = '22222222-2222-4222-8222-222222222222';

function buildClient(revoked = false): ReturnType<ClientBuilder['build']> {
  const now = new Date();
  const builder = new ClientBuilder()
    .withId(CLIENT_ID)
    .withTenantId(TENANT_ID)
    .withName('Acme Corp')
    .withApiKeyId('aaaaaaaaaaaaaaaa')
    .withApiKeySecretHash(
      'b775e7b757ede630cd0aa1113bd102661ab38829ca52a6422ab782862f26801f',
    )
    .withCreatedAt(now)
    .withUpdatedAt(now);
  if (revoked) builder.withRevokedAt(now);
  return builder.build();
}

describe('RevokeClientCommandHandler', () => {
  let handler: RevokeClientCommandHandler;
  let writeRepository: Mocked<IClientWriteRepository>;
  let eventBus: Mocked<EventBus>;

  beforeEach(() => {
    writeRepository = {
      findById: vi.fn(),
      findByApiKeyId: vi.fn(),
      findByCriteria: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    } as unknown as Mocked<IClientWriteRepository>;
    eventBus = { publishAll: vi.fn() } as unknown as Mocked<EventBus>;
    writeRepository.save.mockImplementation((aggregate) =>
      Promise.resolve(aggregate),
    );
    handler = new RevokeClientCommandHandler(writeRepository, eventBus);
  });

  it('throws ClientNotFoundException when the client does not exist', async () => {
    writeRepository.findById.mockResolvedValue(null);

    await expect(
      handler.execute(new RevokeClientCommand({ clientId: CLIENT_ID })),
    ).rejects.toThrow(ClientNotFoundException);
    expect(writeRepository.save).not.toHaveBeenCalled();
  });

  it('throws ClientRevokedException when the client is already revoked', async () => {
    writeRepository.findById.mockResolvedValue(buildClient(true));

    await expect(
      handler.execute(new RevokeClientCommand({ clientId: CLIENT_ID })),
    ).rejects.toThrow(ClientRevokedException);
    expect(writeRepository.save).not.toHaveBeenCalled();
  });

  it('revokes the aggregate, saves it, and publishes events', async () => {
    const client = buildClient();
    writeRepository.findById.mockResolvedValue(client);

    await handler.execute(new RevokeClientCommand({ clientId: CLIENT_ID }));

    expect(client.revokedAt).not.toBeNull();
    expect(writeRepository.save).toHaveBeenCalledTimes(1);
    expect(writeRepository.save).toHaveBeenCalledWith(client);
    expect(eventBus.publishAll).toHaveBeenCalledTimes(1);
  });

  it('never logs the api key hash or id', async () => {
    writeRepository.findById.mockResolvedValue(buildClient());
    const logSpy = vi
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    const errorSpy = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const warnSpy = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    await handler.execute(new RevokeClientCommand({ clientId: CLIENT_ID }));

    const loggedCalls = [
      ...logSpy.mock.calls,
      ...errorSpy.mock.calls,
      ...warnSpy.mock.calls,
    ].flat();
    for (const call of loggedCalls) {
      const serialized = typeof call === 'string' ? call : JSON.stringify(call);
      expect(serialized).not.toContain(
        'b775e7b757ede630cd0aa1113bd102661ab38829ca52a6422ab782862f26801f',
      );
    }

    logSpy.mockRestore();
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });
});
