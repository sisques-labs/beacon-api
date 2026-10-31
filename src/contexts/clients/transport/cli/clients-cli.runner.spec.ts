import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { MockInstance, Mocked, vi } from 'vitest';

import { ClientsCliRunner } from '@contexts/clients/transport/cli/clients-cli.runner';

const CREATE_RESULT = {
  id: '11111111-1111-4111-8111-111111111111',
  tenantId: '22222222-2222-4222-8222-222222222222',
  apiKey: 'bcn_aaaaaaaaaaaaaaaa_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
};

const ROTATE_RESULT = {
  apiKey: 'bcn_cccccccccccccccc_dddddddddddddddddddddddddddddddddddddddddd',
};

const LISTED_CLIENTS = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    tenantId: '22222222-2222-4222-8222-222222222222',
    name: 'Acme Corp',
    apiKeyId: 'aaaaaaaaaaaaaaaa',
    apiKeyRotatedAt: null,
    revokedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  },
];

describe('ClientsCliRunner', () => {
  let commandBus: Mocked<CommandBus>;
  let queryBus: Mocked<QueryBus>;
  let runner: ClientsCliRunner;
  let stdoutSpy: MockInstance<typeof process.stdout.write>;
  let stderrSpy: MockInstance<typeof process.stderr.write>;

  beforeEach(() => {
    commandBus = { execute: vi.fn() } as unknown as Mocked<CommandBus>;
    queryBus = { execute: vi.fn() } as unknown as Mocked<QueryBus>;
    runner = new ClientsCliRunner(commandBus, queryBus);
    stdoutSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  describe('create', () => {
    it('dispatches CreateClientCommand and prints the key exactly once, alone, to stdout', async () => {
      commandBus.execute.mockResolvedValue(CREATE_RESULT);

      const exitCode = await runner.run([
        'create',
        '--name',
        'Acme Corp',
        '--tenant-id',
        CREATE_RESULT.tenantId,
      ]);

      expect(commandBus.execute).toHaveBeenCalledTimes(1);
      const dispatched = commandBus.execute.mock.calls[0][0] as {
        name: { value: string };
        tenantId: { value: string };
      };
      expect(dispatched.name.value).toBe('Acme Corp');
      expect(dispatched.tenantId.value).toBe(CREATE_RESULT.tenantId);
      expect(stdoutSpy).toHaveBeenCalledTimes(1);
      expect(stdoutSpy).toHaveBeenCalledWith(`${CREATE_RESULT.apiKey}\n`);
      expect(exitCode).toBe(0);
    });

    it('rejects with a usage message and a non-zero exit code when --name is missing', async () => {
      const exitCode = await runner.run(['create']);

      expect(commandBus.execute).not.toHaveBeenCalled();
      expect(stdoutSpy).not.toHaveBeenCalled();
      expect(stderrSpy).toHaveBeenCalled();
      const stderrOutput = stderrSpy.mock.calls.map((call) => call[0]).join('');
      expect(stderrOutput).toContain('Usage:');
      expect(exitCode).toBe(1);
    });
  });

  describe('rotate', () => {
    it('dispatches RotateClientApiKeyCommand and prints the new key exactly once, alone, to stdout', async () => {
      commandBus.execute.mockResolvedValue(ROTATE_RESULT);

      const exitCode = await runner.run([
        'rotate',
        '--client-id',
        CREATE_RESULT.id,
      ]);

      expect(commandBus.execute).toHaveBeenCalledTimes(1);
      const dispatched = commandBus.execute.mock.calls[0][0] as {
        clientId: { value: string };
      };
      expect(dispatched.clientId.value).toBe(CREATE_RESULT.id);
      expect(stdoutSpy).toHaveBeenCalledTimes(1);
      expect(stdoutSpy).toHaveBeenCalledWith(`${ROTATE_RESULT.apiKey}\n`);
      expect(exitCode).toBe(0);
    });

    it('rejects with a usage message and a non-zero exit code when --client-id is missing', async () => {
      const exitCode = await runner.run(['rotate']);

      expect(commandBus.execute).not.toHaveBeenCalled();
      expect(stdoutSpy).not.toHaveBeenCalled();
      const stderrOutput = stderrSpy.mock.calls.map((call) => call[0]).join('');
      expect(stderrOutput).toContain('Usage:');
      expect(exitCode).toBe(1);
    });
  });

  describe('revoke', () => {
    it('dispatches RevokeClientCommand and never writes to stdout', async () => {
      commandBus.execute.mockResolvedValue(undefined);

      const exitCode = await runner.run([
        'revoke',
        '--client-id',
        CREATE_RESULT.id,
      ]);

      expect(commandBus.execute).toHaveBeenCalledTimes(1);
      const dispatched = commandBus.execute.mock.calls[0][0] as {
        clientId: { value: string };
      };
      expect(dispatched.clientId.value).toBe(CREATE_RESULT.id);
      expect(stdoutSpy).not.toHaveBeenCalled();
      expect(exitCode).toBe(0);
    });

    it('rejects with a usage message and a non-zero exit code when --client-id is missing', async () => {
      const exitCode = await runner.run(['revoke']);

      expect(commandBus.execute).not.toHaveBeenCalled();
      const stderrOutput = stderrSpy.mock.calls.map((call) => call[0]).join('');
      expect(stderrOutput).toContain('Usage:');
      expect(exitCode).toBe(1);
    });
  });

  describe('list', () => {
    it('dispatches ClientsFindAllQuery and prints metadata without the secret or its hash', async () => {
      queryBus.execute.mockResolvedValue(LISTED_CLIENTS);

      const exitCode = await runner.run(['list']);

      expect(queryBus.execute).toHaveBeenCalledTimes(1);
      const printed = stdoutSpy.mock.calls
        .map((call) => String(call[0]))
        .join('');
      expect(printed).toContain(LISTED_CLIENTS[0].id);
      expect(printed).toContain(LISTED_CLIENTS[0].apiKeyId);
      expect(printed).not.toContain('apiKeySecretHash');
      expect(printed).not.toMatch(/^bcn_/m);
      expect(exitCode).toBe(0);
    });
  });

  describe('malformed input', () => {
    it('rejects an unknown command with a usage message and a non-zero exit code', async () => {
      const exitCode = await runner.run(['bogus']);

      expect(commandBus.execute).not.toHaveBeenCalled();
      expect(queryBus.execute).not.toHaveBeenCalled();
      const stderrOutput = stderrSpy.mock.calls.map((call) => call[0]).join('');
      expect(stderrOutput).toContain('Usage:');
      expect(exitCode).toBe(1);
    });

    it('rejects an unrecognized flag with a usage message and a non-zero exit code', async () => {
      const exitCode = await runner.run([
        'create',
        '--name',
        'Acme Corp',
        '--bogus-flag',
        'value',
      ]);

      expect(commandBus.execute).not.toHaveBeenCalled();
      const stderrOutput = stderrSpy.mock.calls.map((call) => call[0]).join('');
      expect(stderrOutput).toContain('Usage:');
      expect(exitCode).toBe(1);
    });
  });
});
