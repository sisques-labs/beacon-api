import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { BaseCommandHandler, UuidValueObject } from '@sisques-labs/nestjs-kit';

import { CreateClientResult } from '@contexts/clients/application/commands/create-client/create-client-result.interface';
import { CreateClientCommand } from '@contexts/clients/application/commands/create-client/create-client.command';
import {
  API_KEY_GENERATOR_PORT,
  IApiKeyGeneratorPort,
} from '@contexts/clients/application/ports/api-key-generator.port';
import {
  API_KEY_HASHER_PORT,
  IApiKeyHasherPort,
} from '@contexts/clients/application/ports/api-key-hasher.port';
import { ClientAggregate } from '@contexts/clients/domain/aggregates/client.aggregate';
import { ClientBuilder } from '@contexts/clients/domain/builders/client.builder';
import {
  CLIENT_WRITE_REPOSITORY,
  IClientWriteRepository,
} from '@contexts/clients/domain/repositories/write/client-write.repository';

/**
 * Generates a key via `IApiKeyGeneratorPort`, hashes its secret via
 * `IApiKeyHasherPort`, and never touches the plaintext key or secret again
 * once `CreateClientResult.apiKey` is built — the aggregate only ever
 * receives `keyId` and the hash (design.md D16/D17). The log line below
 * logs only `aggregate.id.value`, never `apiKey` or the raw `secret`.
 */
@CommandHandler(CreateClientCommand)
export class CreateClientCommandHandler
  extends BaseCommandHandler<CreateClientCommand, ClientAggregate>
  implements ICommandHandler<CreateClientCommand, CreateClientResult>
{
  private readonly logger = new Logger(CreateClientCommandHandler.name);

  constructor(
    @Inject(CLIENT_WRITE_REPOSITORY)
    private readonly writeRepository: IClientWriteRepository,
    @Inject(API_KEY_GENERATOR_PORT)
    private readonly apiKeyGeneratorPort: IApiKeyGeneratorPort,
    @Inject(API_KEY_HASHER_PORT)
    private readonly apiKeyHasherPort: IApiKeyHasherPort,
    eventBus: EventBus,
  ) {
    super(eventBus);
  }

  async execute(command: CreateClientCommand): Promise<CreateClientResult> {
    const generated = this.apiKeyGeneratorPort.generate();
    const apiKeySecretHash = this.apiKeyHasherPort.hash(generated.secret);

    const now = new Date();
    const aggregate = new ClientBuilder()
      .withId(UuidValueObject.generate().value)
      .withTenantId(command.tenantId.value)
      .withName(command.name.value)
      .withApiKeyId(generated.keyId)
      .withApiKeySecretHash(apiKeySecretHash)
      .withCreatedAt(now)
      .withUpdatedAt(now)
      .build();
    aggregate.create();

    await this.writeRepository.save(aggregate);
    await this.publishEvents(aggregate);
    this.logger.log(`Client ${aggregate.id.value} created`);

    return {
      id: aggregate.id.value,
      tenantId: aggregate.tenantId.value,
      apiKey: generated.key,
    };
  }
}
