import { IBaseReadRepository } from '@sisques-labs/nestjs-kit';

import { ClientViewModel } from '@contexts/clients/domain/view-models/client.view-model';

export const CLIENT_READ_REPOSITORY = Symbol('CLIENT_READ_REPOSITORY');

export interface IClientReadRepository extends IBaseReadRepository<ClientViewModel> {
  /**
   * Lists every client, unfiltered and unpaginated (spec:
   * `client-authentication` "Listing shows metadata but never the secret or
   * its hash"). `IBaseReadRepository.findByCriteria` always paginates, so it
   * cannot express "every client" — this method exists specifically for the
   * CLI listing use case.
   */
  findAll(): Promise<ClientViewModel[]>;
}
