import { appConfig } from '@core/config/app.config';
import { authConfig } from '@core/config/auth.config';
import { eventStoreConfig } from '@core/config/event-store.config';
import { validateEnv } from '@core/config/env.validation';
import { kafkaConfig } from '@core/config/kafka.config';
import { otelConfig } from '@core/config/otel.config';
import { postgresConfig } from '@core/config/postgres.config';
import { AGGREGATE_MODULE_MAP } from '@core/messaging/domain/topics/aggregate-module.map.generated';
import { HealthModule } from '@core/health/health.module';
import { ObservabilityModule } from '@core/observability/observability.module';
import { PingResolver } from '@core/transport/graphql/resolvers/ping.resolver';
import '@core/transport/graphql/registered-enums.graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { GraphQLModule } from '@nestjs/graphql';
import { JwtModuleOptions } from '@nestjs/jwt';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { AuthClientModule } from '@sisques-labs/nestjs-kit/auth-client';
import { EventStoreModule } from '@sisques-labs/nestjs-kit/event-store';
import { SharedGraphQLModule } from '@sisques-labs/nestjs-kit/graphql';
import { McpModule } from '@sisques-labs/nestjs-kit/mcp';
import { MessagingModule } from '@sisques-labs/nestjs-kit/messaging';

import { SupportModule } from '@support/support.module';

// Cross-cutting infrastructure every bounded context relies on: config, DB,
// transports, observability. Add new app-wide wiring here, not in AppModule.
const CORE_MODULES = [
  SupportModule,
  CqrsModule.forRoot(),
  SharedGraphQLModule,
  ConfigModule.forRoot({
    isGlobal: true,
    validate: validateEnv,
    load: [
      postgresConfig,
      appConfig,
      otelConfig,
      kafkaConfig,
      eventStoreConfig,
      authConfig,
    ],
    cache: true,
  }),
  TypeOrmModule.forRootAsync({
    inject: [ConfigService],
    useFactory: (config: ConfigService) =>
      config.getOrThrow<TypeOrmModuleOptions>('postgres'),
  }),
  // REST controllers are documented via Swagger (see main.ts). GraphQL is
  // wired alongside it — drop whichever transport this service doesn't use.
  GraphQLModule.forRoot<ApolloDriverConfig>({
    driver: ApolloDriver,
    autoSchemaFile: true,
    playground: true,
    context: ({ req, res }: { req: Request; res: Response }) => ({
      req,
      res,
    }),
  }),
  ObservabilityModule,
  MessagingModule.forRoot({ aggregateModuleMap: AGGREGATE_MODULE_MAP }),
  EventStoreModule.forRoot(),
  HealthModule,
  // Verifies Sisques Account access tokens (the platform's shared
  // identity/tenancy service) — opt-in per this service's choice: set
  // AUTH_ENABLED=true + AUTH_JWT_SECRET to actually use `JwtAuthGuard` /
  // `@CurrentUser()` on a route. A service that never sets those env vars
  // boots exactly as before; this module never opens a connection or
  // blocks anything on its own. Tenant-scoped authorization on top of the
  // same `request.user.tenants` claim is bring-your-own per bounded
  // context — see `@sisques-labs/nestjs-kit/rbac`.
  AuthClientModule.forRootAsync({
    inject: [ConfigService],
    useFactory: (config: ConfigService): JwtModuleOptions => ({
      secret: config.get<string>('auth.jwtSecret'),
    }),
  }),
  // Pass `contextBuilder` here once a context needs the caller's identity
  // inside an MCP tool — see `JwtAuthGuard`/`@CurrentUser()` above and
  // `IMcpContextBuilder` from `@sisques-labs/nestjs-kit/mcp`.
  McpModule.forRoot({ name: 'nestjs-template', version: '0.1.0' }),
];

@Module({
  imports: [...CORE_MODULES],
  providers: [PingResolver],
})
export class CoreModule {}
