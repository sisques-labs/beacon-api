import { Inject, Logger } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { ClientsFindAllQuery } from '@contexts/clients/application/queries/clients-find-all/clients-find-all.query';
import {
  CLIENT_READ_REPOSITORY,
  IClientReadRepository,
} from '@contexts/clients/domain/repositories/read/client-read.repository';
import { ClientViewModel } from '@contexts/clients/domain/view-models/client.view-model';

/**
 * Thin delegate to the metadata-only read repository (spec:
 * `client-authentication` "Listing shows metadata but never the secret or
 * its hash"). `ClientViewModel` has no `apiKeySecretHash` field at all
 * (D17), so the hash can never leak through this path regardless of what
 * the repository selects.
 */
@QueryHandler(ClientsFindAllQuery)
export class ClientsFindAllHandler implements IQueryHandler<
  ClientsFindAllQuery,
  ClientViewModel[]
> {
  private readonly logger = new Logger(ClientsFindAllHandler.name);

  constructor(
    @Inject(CLIENT_READ_REPOSITORY)
    private readonly readRepository: IClientReadRepository,
  ) {}

  async execute(): Promise<ClientViewModel[]> {
    this.logger.log('Listing all clients');
    return this.readRepository.findAll();
  }
}
