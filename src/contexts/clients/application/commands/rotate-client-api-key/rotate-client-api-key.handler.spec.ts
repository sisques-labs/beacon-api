import { EventBus } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { Mocked, vi } from 'vitest';

import { RotateClientApiKeyCommand } from '@contexts/clients/application/commands/rotate-client-api-key/rotate-client-api-key.command';
import { RotateClientApiKeyCommandHandler } from '@contexts/clients/application/commands/rotate-client-api-key/rotate-client-api-key.handler';
import { IApiKeyGeneratorPort } from '@contexts/clients/application/ports/api-key-generator.port';
import { IApiKeyHasherPort } from '@contexts/clients/application/ports/api-key-hasher.port';
import { ClientBuilder } from '@contexts/clients/domain/builders/client.builder';
import { ClientNotFoundException } from '@contexts/clients/domain/exceptions/client-not-found.exception';
import { ClientRevokedException } from '@contexts/clients/domain/exceptions/client-revoked.exception';
import { IClientWriteRepository } from '@contexts/clients/domain/repositories/write/client-write.repository';

const CLIENT_ID = '11111111-1111-4111-8111-111111111111';
const TENANT_ID = '22222222-2222-4222-8222-222222222222';

const GENERATED = {
  key: 'bcn_cccccccccccccccc_ddddddddddddddddddddddddddddddddddddddddddd',
  keyId: 'cccccccccccccccc',
  secret: 'ddddddddddddddddddddddddddddddddddddddddddd',
};

const HASH = 'e775e7b757ede630cd0aa1113bd102661ab38829ca52a6422ab782862f26801f';

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

describe('RotateClientApiKeyCommandHandler', () => {
  let handler: RotateClientApiKeyCommandHandler;
  let writeRepository: Mocked<IClientWriteRepository>;
  let apiKeyGeneratorPort: Mocked<IApiKeyGeneratorPort>;
  let apiKeyHasherPort: Mocked<IApiKeyHasherPort>;
  let eventBus: Mocked<EventBus>;

  beforeEach(() => {
    writeRepository = {
      findById: vi.fn(),
      findByApiKeyId: vi.fn(),
      findByCriteria: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    } as unknown as Mocked<IClientWriteRepository>;
    apiKeyGeneratorPort = { generate: vi.fn().mockReturnValue(GENERATED) };
    apiKeyHasherPort = { hash: vi.fn().mockReturnValue(HASH) };
    eventBus = { publishAll: vi.fn() } as unknown as Mocked<EventBus>;
    writeRepository.save.mockImplementation((aggregate) =>
      Promise.resolve(aggregate),
    );
    handler = new RotateClientApiKeyCommandHandler(
      writeRepository,
      apiKeyGeneratorPort,
      apiKeyHasherPort,
      eventBus,
    );
  });

  it('throws ClientNotFoundException when the client does not exist', async () => {
    writeRepository.findById.mockResolvedValue(null);

    await expect(
      handler.execute(new RotateClientApiKeyCommand({ clientId: CLIENT_ID })),
    ).rejects.toThrow(ClientNotFoundException);
    expect(writeRepository.save).not.toHaveBeenCalled();
  });

  it('throws ClientRevokedException when the client is revoked', async () => {
    writeRepository.findById.mockResolvedValue(buildClient(true));

    await expect(
      handler.execute(new RotateClientApiKeyCommand({ clientId: CLIENT_ID })),
    ).rejects.toThrow(ClientRevokedException);
    expect(writeRepository.save).not.toHaveBeenCalled();
  });

  it('generates a new key, hashes it, rotates the aggregate, and saves it', async () => {
    writeRepository.findById.mockResolvedValue(buildClient());

    const result = await handler.execute(
      new RotateClientApiKeyCommand({ clientId: CLIENT_ID }),
    );

    expect(apiKeyGeneratorPort.generate).toHaveBeenCalledTimes(1);
    expect(apiKeyHasherPort.hash).toHaveBeenCalledWith(GENERATED.secret);
    expect(writeRepository.save).toHaveBeenCalledTimes(1);
    const saved = writeRepository.save.mock.calls[0][0];
    expect(saved.apiKeyId.value).toBe(GENERATED.keyId);
    expect(saved.apiKeySecretHash.value).toBe(HASH);
    expect(eventBus.publishAll).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ apiKey: GENERATED.key });
  });

  it('never logs the plaintext key or secret', async () => {
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

    await handler.execute(
      new RotateClientApiKeyCommand({ clientId: CLIENT_ID }),
    );

    const loggedCalls = [
      ...logSpy.mock.calls,
      ...errorSpy.mock.calls,
      ...warnSpy.mock.calls,
    ].flat();
    for (const call of loggedCalls) {
      const serialized = typeof call === 'string' ? call : JSON.stringify(call);
      expect(serialized).not.toContain(GENERATED.key);
      expect(serialized).not.toContain(GENERATED.secret);
    }

    logSpy.mockRestore();
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });
});
