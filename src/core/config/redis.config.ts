import { registerAs } from '@nestjs/config';

import { IRedisConfig } from '@core/config/interfaces/redis-config.interface';

/**
 * Connection options for the required Redis dependency (design.md D7 — no
 * `REDIS_ENABLED` gate, unlike `kafka-ingest.config.ts`: delivery durability
 * must never be silently optional). Consumed by both `BullModule.forRootAsync`
 * (core.module.ts) and `RedisHealthIndicator` (design.md D8).
 */
export const redisConfig = registerAs('redis', (): IRedisConfig => ({
  host: process.env.REDIS_HOST ?? '',
  port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  password: process.env.REDIS_PASSWORD?.trim() || undefined,
  db: parseInt(process.env.REDIS_DB ?? '0', 10),
}));
