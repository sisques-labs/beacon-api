import '@contexts/notifications/transport/graphql/enums/notification-registered-enums.graphql';

import { BullModule } from '@nestjs/bullmq';
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CreateNotificationCommandHandler } from '@contexts/notifications/application/commands/create-notification/create-notification.handler';
import { DeliverNotificationCommandHandler } from '@contexts/notifications/application/commands/deliver-notification/deliver-notification.handler';
import { DeliverNotificationOnCreatedHandler } from '@contexts/notifications/application/events/deliver-notification-on-created.handler';
import { NOTIFICATION_DELIVERY_QUEUE_PORT } from '@contexts/notifications/application/ports/notification-delivery-queue.port';
import { NOTIFICATION_SENDER_PORT } from '@contexts/notifications/application/ports/notification-sender.port';
import { NotificationFindByIdHandler } from '@contexts/notifications/application/queries/notification-find-by-id/notification-find-by-id.handler';
import { AssertNotificationViewModelExistsService } from '@contexts/notifications/application/services/read/assert-notification-view-model-exists/assert-notification-view-model-exists.service';
import { AssertNotificationAggregateExistsService } from '@contexts/notifications/application/services/write/assert-notification-aggregate-exists.service';
import { FindNotificationByDedupeKeyService } from '@contexts/notifications/application/services/write/find-notification-by-dedupe-key/find-notification-by-dedupe-key.service';
import { NOTIFICATION_READ_REPOSITORY } from '@contexts/notifications/domain/repositories/read/notification-read.repository';
import { NOTIFICATION_WRITE_REPOSITORY } from '@contexts/notifications/domain/repositories/write/notification-write.repository';
import { BullMqNotificationDeliveryQueueAdapter } from '@contexts/notifications/infrastructure/adapters/bullmq-notification-delivery-queue.adapter';
import { DiscordWebhookNotificationSenderAdapter } from '@contexts/notifications/infrastructure/adapters/discord-webhook-notification-sender.adapter';
import { discordConfig } from '@contexts/notifications/infrastructure/config/discord.config';
import { notificationDeliveryQueueConfig } from '@contexts/notifications/infrastructure/config/notification-delivery-queue.config';
import { NotificationEntity } from '@contexts/notifications/infrastructure/persistence/typeorm/entities/notification.entity';
import { NotificationTypeormMapper } from '@contexts/notifications/infrastructure/persistence/typeorm/mappers/notification-typeorm.mapper';
import { NotificationTypeormReadRepository } from '@contexts/notifications/infrastructure/persistence/typeorm/repositories/notification-typeorm-read.repository';
import { NotificationTypeormWriteRepository } from '@contexts/notifications/infrastructure/persistence/typeorm/repositories/notification-typeorm-write.repository';
import { NotificationGraphQLMapper } from '@contexts/notifications/transport/graphql/mappers/notification.mapper';
import { NotificationQueriesResolver } from '@contexts/notifications/transport/graphql/resolvers/queries/notification-queries.resolver';
import { NotificationIngestConsumer } from '@contexts/notifications/transport/kafka/consumers/notification-ingest.consumer';
import { NotificationDeliveryProcessor } from '@contexts/notifications/transport/queue/processors/notification-delivery.processor';
import { NotificationController } from '@contexts/notifications/transport/rest/notification.controller';

const COMMAND_HANDLERS = [
  CreateNotificationCommandHandler,
  DeliverNotificationCommandHandler,
];
const EVENT_HANDLERS = [DeliverNotificationOnCreatedHandler];
const QUERY_HANDLERS = [NotificationFindByIdHandler];
const APPLICATION_SERVICES = [
  AssertNotificationViewModelExistsService,
  AssertNotificationAggregateExistsService,
  FindNotificationByDedupeKeyService,
];
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
  {
    provide: NOTIFICATION_SENDER_PORT,
    useClass: DiscordWebhookNotificationSenderAdapter,
  },
  {
    provide: NOTIFICATION_DELIVERY_QUEUE_PORT,
    useClass: BullMqNotificationDeliveryQueueAdapter,
  },
];
const GRAPHQL_PROVIDERS = [
  NotificationQueriesResolver,
  NotificationGraphQLMapper,
];
const KAFKA_CONSUMERS = [NotificationIngestConsumer];
const QUEUE_PROCESSORS = [NotificationDeliveryProcessor];

@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([NotificationEntity]),
    ConfigModule.forFeature(discordConfig),
    ConfigModule.forFeature(notificationDeliveryQueueConfig),
    BullModule.registerQueue({ name: notificationDeliveryQueueConfig().name }),
    HttpModule,
  ],
  controllers: [NotificationController],
  providers: [
    ...COMMAND_HANDLERS,
    ...EVENT_HANDLERS,
    ...QUERY_HANDLERS,
    ...APPLICATION_SERVICES,
    ...INFRASTRUCTURE_MAPPERS,
    ...INFRASTRUCTURE_REPOSITORIES,
    ...GRAPHQL_PROVIDERS,
    ...KAFKA_CONSUMERS,
    ...QUEUE_PROCESSORS,
  ],
})
export class NotificationsModule {}
