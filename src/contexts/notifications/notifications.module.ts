import '@contexts/notifications/transport/graphql/enums/notification-registered-enums.graphql';

import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CreateNotificationCommandHandler } from '@contexts/notifications/application/commands/create-notification/create-notification.handler';
import { NotificationFindByIdHandler } from '@contexts/notifications/application/queries/notification-find-by-id/notification-find-by-id.handler';
import { AssertNotificationViewModelExistsService } from '@contexts/notifications/application/services/read/assert-notification-view-model-exists.service';
import { NOTIFICATION_READ_REPOSITORY } from '@contexts/notifications/domain/repositories/read/notification-read.repository';
import { NOTIFICATION_WRITE_REPOSITORY } from '@contexts/notifications/domain/repositories/write/notification-write.repository';
import { NotificationEntity } from '@contexts/notifications/infrastructure/persistence/typeorm/entities/notification.entity';
import { NotificationTypeormMapper } from '@contexts/notifications/infrastructure/persistence/typeorm/mappers/notification-typeorm.mapper';
import { NotificationTypeormReadRepository } from '@contexts/notifications/infrastructure/persistence/typeorm/repositories/notification-typeorm-read.repository';
import { NotificationTypeormWriteRepository } from '@contexts/notifications/infrastructure/persistence/typeorm/repositories/notification-typeorm-write.repository';
import { NotificationGraphQLMapper } from '@contexts/notifications/transport/graphql/mappers/notification.mapper';
import { NotificationQueriesResolver } from '@contexts/notifications/transport/graphql/resolvers/queries/notification-queries.resolver';
import { NotificationIngestConsumer } from '@contexts/notifications/transport/kafka/consumers/notification-ingest.consumer';
import { NotificationController } from '@contexts/notifications/transport/rest/notification.controller';

const COMMAND_HANDLERS = [CreateNotificationCommandHandler];
const QUERY_HANDLERS = [NotificationFindByIdHandler];
const APPLICATION_SERVICES = [AssertNotificationViewModelExistsService];
const INFRASTRUCTURE_MAPPERS = [NotificationTypeormMapper];
const INFRASTRUCTURE_REPOSITORIES = [
  {
    provide: NOTIFICATION_WRITE_REPOSITORY,
    useClass: NotificationTypeormWriteRepository,
  },
  {
    provide: NOTIFICATION_READ_REPOSITORY,
    useClass: NotificationTypeormReadRepository,
  },
];
const GRAPHQL_PROVIDERS = [
  NotificationQueriesResolver,
  NotificationGraphQLMapper,
];
const KAFKA_CONSUMERS = [NotificationIngestConsumer];

@Module({
  imports: [CqrsModule, TypeOrmModule.forFeature([NotificationEntity])],
  controllers: [NotificationController],
  providers: [
    ...COMMAND_HANDLERS,
    ...QUERY_HANDLERS,
    ...APPLICATION_SERVICES,
    ...INFRASTRUCTURE_MAPPERS,
    ...INFRASTRUCTURE_REPOSITORIES,
    ...GRAPHQL_PROVIDERS,
    ...KAFKA_CONSUMERS,
  ],
})
export class NotificationsModule {}
