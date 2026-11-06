import { EventBus } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { Mocked, vi } from 'vitest';

import { CreateClientCommand } from '@contexts/clients/application/commands/create-client/create-client.command';
import { CreateClientCommandHandler } from '@contexts/clients/application/commands/create-client/create-client.handler';
import { IApiKeyGeneratorPort } from '@contexts/clients/application/ports/api-key-generator.port';
import { IApiKeyHasherPort } from '@contexts/clients/application/ports/api-key-hasher.port';
import { IClientWriteRepository } from '@contexts/clients/domain/repositories/write/client-write.repository';

const VALID_INPUT = {
  name: 'Acme Corp',
  tenantId: '11111111-1111-4111-8111-111111111111',
};

const GENERATED = {
  key: 'bcn_aaaaaaaaaaaaaaaa_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  keyId: 'aaaaaaaaaaaaaaaa',
  secret: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
};

const HASH = 'c775e7b757ede630cd0aa1113bd102661ab38829ca52a6422ab782862f26801f';

describe('CreateClientCommandHandler', () => {
  let handler: CreateClientCommandHandler;
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
    handler = new CreateClientCommandHandler(
      writeRepository,
      apiKeyGeneratorPort,
      apiKeyHasherPort,
      eventBus,
    );
  });

  it('generates a key, hashes it, builds and creates the aggregate, and saves it', async () => {
    const result = await handler.execute(new CreateClientCommand(VALID_INPUT));

    expect(apiKeyGeneratorPort.generate).toHaveBeenCalledTimes(1);
    expect(apiKeyHasherPort.hash).toHaveBeenCalledWith(GENERATED.secret);
    expect(writeRepository.save).toHaveBeenCalledTimes(1);
    const saved = writeRepository.save.mock.calls[0][0];
    expect(saved.tenantId.value).toBe(VALID_INPUT.tenantId);
    expect(saved.name.value).toBe(VALID_INPUT.name);
    expect(saved.apiKeyId.value).toBe(GENERATED.keyId);
    expect(saved.apiKeySecretHash.value).toBe(HASH);
    expect(eventBus.publishAll).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      id: saved.id.value,
      tenantId: VALID_INPUT.tenantId,
      apiKey: GENERATED.key,
    });
  });

  it('never logs the plaintext key or secret', async () => {
    const logSpy = vi
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    const errorSpy = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const warnSpy = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    await handler.execute(new CreateClientCommand(VALID_INPUT));

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
