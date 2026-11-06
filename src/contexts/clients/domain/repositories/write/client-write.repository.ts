import { IBaseWriteRepository } from '@sisques-labs/nestjs-kit';

import { ClientAggregate } from '@contexts/clients/domain/aggregates/client.aggregate';

export const CLIENT_WRITE_REPOSITORY = Symbol('CLIENT_WRITE_REPOSITORY');

export interface IClientWriteRepository extends IBaseWriteRepository<ClientAggregate> {
  findByApiKeyId(apiKeyId: string): Promise<ClientAggregate | null>;
}
