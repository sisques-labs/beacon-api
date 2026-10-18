import { Injectable } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { parseArgs } from 'node:util';

import { CreateClientResult } from '@contexts/clients/application/commands/create-client/create-client-result.interface';
import { CreateClientCommand } from '@contexts/clients/application/commands/create-client/create-client.command';
import { RevokeClientCommand } from '@contexts/clients/application/commands/revoke-client/revoke-client.command';
import { RotateClientApiKeyResult } from '@contexts/clients/application/commands/rotate-client-api-key/rotate-client-api-key-result.interface';
import { RotateClientApiKeyCommand } from '@contexts/clients/application/commands/rotate-client-api-key/rotate-client-api-key.command';
import { ClientsFindAllQuery } from '@contexts/clients/application/queries/clients-find-all/clients-find-all.query';
import { ClientViewModel } from '@contexts/clients/domain/view-models/client.view-model';

const USAGE = [
  'Usage:',
  '  create --name <name> [--tenant-id <uuid>]',
  '  rotate --client-id <id>',
  '  revoke --client-id <id>',
  '  list',
].join('\n');

/**
 * Parses argv with `node:util` `parseArgs` (design.md D20) and dispatches
 * exclusively through `CommandBus`/`QueryBus` — this class never touches a
 * repository, port, or aggregate directly. A generated/rotated key is
 * written to stdout exactly once and alone (`${key}\n`, nothing else on
 * that stream for the same invocation), so it can be piped straight into a
 * secret manager. Every other message — confirmations, usage errors — goes
 * to stderr. Nothing here ever calls a `Logger`; the plaintext key/secret
 * never reach one either, matching the handler-level guarantee this runner
 * sits in front of.
 */
@Injectable()
export class ClientsCliRunner {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  async run(argv: string[]): Promise<number> {
    const [subcommand, ...args] = argv;

    try {
      switch (subcommand) {
        case 'create':
          return await this.create(args);
        case 'rotate':
          return await this.rotate(args);
        case 'revoke':
          return await this.revoke(args);
        case 'list':
          return await this.list(args);
        default:
          return this.usageError(`Unknown command: ${subcommand ?? '(none)'}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`Error: ${message}\n`);
      return 1;
    }
  }

  private usageError(reason: string): number {
    process.stderr.write(`${reason}\n${USAGE}\n`);
    return 1;
  }

  private async create(args: string[]): Promise<number> {
    let name: string | undefined;
    let tenantId: string | undefined;
    try {
      const parsed = parseArgs({
        args,
        options: {
          name: { type: 'string' },
          'tenant-id': { type: 'string' },
        },
        strict: true,
      });
      name = parsed.values.name;
      tenantId = parsed.values['tenant-id'];
    } catch {
      return this.usageError('create: invalid arguments');
    }

    if (!name) return this.usageError('create requires --name <name>');

    const result = await this.commandBus.execute<
      CreateClientCommand,
      CreateClientResult
    >(new CreateClientCommand({ name, tenantId }));

    process.stderr.write(
      `Client ${result.id} created (tenantId=${result.tenantId})\n`,
    );
    process.stdout.write(`${result.apiKey}\n`);
    return 0;
  }

  private async rotate(args: string[]): Promise<number> {
    const clientId = this.parseClientId(args);
    if (!clientId) return this.usageError('rotate requires --client-id <id>');

    const result = await this.commandBus.execute<
      RotateClientApiKeyCommand,
      RotateClientApiKeyResult
    >(new RotateClientApiKeyCommand({ clientId }));

    process.stderr.write(`Client ${clientId} API key rotated\n`);
    process.stdout.write(`${result.apiKey}\n`);
    return 0;
  }

  private async revoke(args: string[]): Promise<number> {
    const clientId = this.parseClientId(args);
    if (!clientId) return this.usageError('revoke requires --client-id <id>');

    await this.commandBus.execute<RevokeClientCommand, void>(
      new RevokeClientCommand({ clientId }),
    );

    process.stderr.write(`Client ${clientId} revoked\n`);
    return 0;
  }

  private async list(args: string[]): Promise<number> {
    try {
      parseArgs({ args, options: {}, strict: true });
    } catch {
      return this.usageError('list: invalid arguments');
    }

    const clients = await this.queryBus.execute<
      ClientsFindAllQuery,
      ClientViewModel[]
    >(new ClientsFindAllQuery());

    for (const client of clients) {
      process.stdout.write(
        `${client.id}\t${client.tenantId}\t${client.name}\t${client.apiKeyId}\t${client.revokedAt ? 'revoked' : 'active'}\n`,
      );
    }
    return 0;
  }

  private parseClientId(args: string[]): string | undefined {
    try {
      const parsed = parseArgs({
        args,
        options: { 'client-id': { type: 'string' } },
        strict: true,
      });
      return parsed.values['client-id'];
    } catch {
      return undefined;
    }
  }
}
