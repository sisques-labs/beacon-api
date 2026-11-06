import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { BaseCommandHandler } from '@sisques-labs/nestjs-kit';

import { RotateClientApiKeyResult } from '@contexts/clients/application/commands/rotate-client-api-key/rotate-client-api-key-result.interface';
import { RotateClientApiKeyCommand } from '@contexts/clients/application/commands/rotate-client-api-key/rotate-client-api-key.command';
import {
  API_KEY_GENERATOR_PORT,
  IApiKeyGeneratorPort,
} from '@contexts/clients/application/ports/api-key-generator.port';
import {
  API_KEY_HASHER_PORT,
  IApiKeyHasherPort,
} from '@contexts/clients/application/ports/api-key-hasher.port';
import { ClientAggregate } from '@contexts/clients/domain/aggregates/client.aggregate';
import { ClientNotFoundException } from '@contexts/clients/domain/exceptions/client-not-found.exception';
import {
  CLIENT_WRITE_REPOSITORY,
  IClientWriteRepository,
} from '@contexts/clients/domain/repositories/write/client-write.repository';
import { ApiKeyIdValueObject } from '@contexts/clients/domain/value-objects/api-key-id/api-key-id.value-object';
import { ApiKeySecretHashValueObject } from '@contexts/clients/domain/value-objects/api-key-secret-hash/api-key-secret-hash.value-object';

/**
 * Loads the client by id, generates a new key via `IApiKeyGeneratorPort`,
 * hashes its secret via `IApiKeyHasherPort`, and calls
 * `ClientAggregate.rotateApiKey()`, which throws `ClientRevokedException`
 * when the client is already revoked (D18). The log line below logs only
 * `aggregate.id.value`, never `apiKey` or the raw `secret`.
 */
@CommandHandler(RotateClientApiKeyCommand)
export class RotateClientApiKeyCommandHandler
  extends BaseCommandHandler<RotateClientApiKeyCommand, ClientAggregate>
  implements
    ICommandHandler<RotateClientApiKeyCommand, RotateClientApiKeyResult>
{
  private readonly logger = new Logger(RotateClientApiKeyCommandHandler.name);

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

  async execute(
    command: RotateClientApiKeyCommand,
  ): Promise<RotateClientApiKeyResult> {
    const aggregate = await this.writeRepository.findById(
      command.clientId.value,
    );
    if (!aggregate) throw new ClientNotFoundException();

    const generated = this.apiKeyGeneratorPort.generate();
    const apiKeySecretHash = this.apiKeyHasherPort.hash(generated.secret);

    aggregate.rotateApiKey(
      new ApiKeyIdValueObject(generated.keyId),
      new ApiKeySecretHashValueObject(apiKeySecretHash),
    );

    await this.writeRepository.save(aggregate);
    await this.publishEvents(aggregate);
    this.logger.log(`Client ${aggregate.id.value} API key rotated`);

    return { apiKey: generated.key };
  }
}
