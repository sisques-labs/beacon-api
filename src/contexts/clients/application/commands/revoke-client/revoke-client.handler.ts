import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { BaseCommandHandler } from '@sisques-labs/nestjs-kit';

import { RevokeClientCommand } from '@contexts/clients/application/commands/revoke-client/revoke-client.command';
import { ClientAggregate } from '@contexts/clients/domain/aggregates/client.aggregate';
import { ClientNotFoundException } from '@contexts/clients/domain/exceptions/client-not-found.exception';
import {
  CLIENT_WRITE_REPOSITORY,
  IClientWriteRepository,
} from '@contexts/clients/domain/repositories/write/client-write.repository';

/**
 * Loads the client by id and calls `ClientAggregate.revoke()`, which
 * throws `ClientRevokedException` when the client is already revoked
 * (D19). Revocation is terminal — there is no un-revoke. The log line
 * below logs only `aggregate.id.value`, never the api key id or hash.
 */
@CommandHandler(RevokeClientCommand)
export class RevokeClientCommandHandler
  extends BaseCommandHandler<RevokeClientCommand, ClientAggregate>
  implements ICommandHandler<RevokeClientCommand, void>
{
  private readonly logger = new Logger(RevokeClientCommandHandler.name);

  constructor(
    @Inject(CLIENT_WRITE_REPOSITORY)
    private readonly writeRepository: IClientWriteRepository,
    eventBus: EventBus,
  ) {
    super(eventBus);
  }

  async execute(command: RevokeClientCommand): Promise<void> {
    const aggregate = await this.writeRepository.findById(
      command.clientId.value,
    );
    if (!aggregate) throw new ClientNotFoundException();

    aggregate.revoke();

    await this.writeRepository.save(aggregate);
    await this.publishEvents(aggregate);
    this.logger.log(`Client ${aggregate.id.value} revoked`);
  }
}
