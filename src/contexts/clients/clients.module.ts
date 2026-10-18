import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CreateClientCommandHandler } from '@contexts/clients/application/commands/create-client/create-client.handler';
import { RevokeClientCommandHandler } from '@contexts/clients/application/commands/revoke-client/revoke-client.handler';
import { RotateClientApiKeyCommandHandler } from '@contexts/clients/application/commands/rotate-client-api-key/rotate-client-api-key.handler';
import { API_KEY_GENERATOR_PORT } from '@contexts/clients/application/ports/api-key-generator.port';
import { API_KEY_HASHER_PORT } from '@contexts/clients/application/ports/api-key-hasher.port';
import { ClientFindByApiKeyHandler } from '@contexts/clients/application/queries/client-find-by-api-key/client-find-by-api-key.handler';
import { ClientsFindAllHandler } from '@contexts/clients/application/queries/clients-find-all/clients-find-all.handler';
import { AuthenticateClientApiKeyService } from '@contexts/clients/application/services/write/authenticate-client-api-key/authenticate-client-api-key.service';
import { ClientBuilder } from '@contexts/clients/domain/builders/client.builder';
import { CLIENT_READ_REPOSITORY } from '@contexts/clients/domain/repositories/read/client-read.repository';
import { CLIENT_WRITE_REPOSITORY } from '@contexts/clients/domain/repositories/write/client-write.repository';
import { RandomApiKeyGeneratorAdapter } from '@contexts/clients/infrastructure/adapters/random-api-key-generator.adapter';
import { Sha256ApiKeyHasherAdapter } from '@contexts/clients/infrastructure/adapters/sha256-api-key-hasher.adapter';
import { ClientEntity } from '@contexts/clients/infrastructure/persistence/typeorm/entities/client.entity';
import { ClientTypeormMapper } from '@contexts/clients/infrastructure/persistence/typeorm/mappers/client-typeorm.mapper';
import { ClientTypeormReadRepository } from '@contexts/clients/infrastructure/persistence/typeorm/repositories/client-typeorm-read.repository';
import { ClientTypeormWriteRepository } from '@contexts/clients/infrastructure/persistence/typeorm/repositories/client-typeorm-write.repository';

const COMMAND_HANDLERS = [
  CreateClientCommandHandler,
  RotateClientApiKeyCommandHandler,
  RevokeClientCommandHandler,
];
const QUERY_HANDLERS = [ClientFindByApiKeyHandler, ClientsFindAllHandler];
const DOMAIN_BUILDERS = [ClientBuilder];
const APPLICATION_SERVICES = [AuthenticateClientApiKeyService];
const INFRASTRUCTURE_MAPPERS = [ClientTypeormMapper];
const INFRASTRUCTURE_ENTITIES = [ClientEntity];
const INFRASTRUCTURE_REPOSITORIES = [
  {
    provide: CLIENT_WRITE_REPOSITORY,
    useClass: ClientTypeormWriteRepository,
  },
  {
    provide: CLIENT_READ_REPOSITORY,
    useClass: ClientTypeormReadRepository,
  },
  {
    provide: API_KEY_GENERATOR_PORT,
    useClass: RandomApiKeyGeneratorAdapter,
  },
  {
    provide: API_KEY_HASHER_PORT,
    useClass: Sha256ApiKeyHasherAdapter,
  },
];

@Module({
  imports: [CqrsModule, TypeOrmModule.forFeature(INFRASTRUCTURE_ENTITIES)],
  providers: [
    ...COMMAND_HANDLERS,
    ...QUERY_HANDLERS,
    ...DOMAIN_BUILDERS,
    ...APPLICATION_SERVICES,
    ...INFRASTRUCTURE_MAPPERS,
    ...INFRASTRUCTURE_REPOSITORIES,
  ],
})
export class ClientsModule {}
