import { IBaseReadRepository } from '@sisques-labs/nestjs-kit';

import { ClientViewModel } from '@contexts/clients/domain/view-models/client.view-model';

export const CLIENT_READ_REPOSITORY = Symbol('CLIENT_READ_REPOSITORY');

export type IClientReadRepository = IBaseReadRepository<ClientViewModel>;
