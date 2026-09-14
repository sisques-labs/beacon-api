import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { Redis } from 'ioredis';

import { IRedisConfig } from '@core/config/interfaces/redis-config.interface';
import { REDIS_HEALTH_CLIENT } from '@core/health/indicators/redis-health-client.token';
import { RedisHealthIndicator } from '@core/health/indicators/redis.health-indicator';
import { HealthController } from '@core/health/transport/rest/controllers/health.controller';

const HEALTH_INDICATORS = [RedisHealthIndicator];

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [
    ...HEALTH_INDICATORS,
    {
      provide: REDIS_HEALTH_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redis = config.getOrThrow<IRedisConfig>('redis');
        return new Redis({
          host: redis.host,
          port: redis.port,
          password: redis.password,
          db: redis.db,
          // Dedicated ping-only client (design.md D8) — lazy connect so a
          // Redis outage never blocks app boot, only readiness reporting.
          lazyConnect: true,
          maxRetriesPerRequest: 1,
        });
      },
    },
  ],
  exports: [REDIS_HEALTH_CLIENT],
})
export class HealthModule {}
