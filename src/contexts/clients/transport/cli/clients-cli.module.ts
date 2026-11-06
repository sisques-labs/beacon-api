import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';

import { postgresConfig } from '@core/config/postgres.config';
import { validateEnv } from '@core/config/env.validation';

import { ClientsModule } from '@contexts/clients/clients.module';
import { ClientsCliRunner } from '@contexts/clients/transport/cli/clients-cli.runner';

/**
 * Standalone application-context module for `src/cli.ts` (design.md D20).
 * Deliberately minimal — config, TypeORM and `CqrsModule` only, no HTTP,
 * GraphQL, Kafka or BullMQ. `ClientsModule` (and everything it needs) is
 * the only bounded-context surface loaded; `ClientAggregate`'s events are
 * published in-process on the CQRS `EventBus` and never forwarded to
 * Kafka, since `@sisques-labs/nestjs-kit/messaging`'s `MessagingModule` is
 * never imported here.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      load: [postgresConfig],
      cache: true,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        config.getOrThrow<TypeOrmModuleOptions>('postgres'),
    }),
    CqrsModule,
    ClientsModule,
  ],
  providers: [ClientsCliRunner],
})
export class ClientsCliModule {}
