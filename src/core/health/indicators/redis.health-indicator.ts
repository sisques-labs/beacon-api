import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  HealthIndicatorResult,
  HealthIndicatorService,
} from '@nestjs/terminus';
import { Redis } from 'ioredis';

import { REDIS_HEALTH_CLIENT } from '@core/health/indicators/redis-health-client.token';

/**
 * Redis readiness indicator (design.md D8). Uses its own small `ioredis`
 * client rather than reusing BullMQ's — BullMQ requires
 * `maxRetriesPerRequest: null` and holds blocking connections, which is a
 * known footgun for a simple ping.
 */
@Injectable()
export class RedisHealthIndicator {
  private readonly logger = new Logger(RedisHealthIndicator.name);

  constructor(
    @Inject(REDIS_HEALTH_CLIENT) private readonly redisClient: Redis,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async pingCheck<Key extends string>(
    key: Key,
  ): Promise<HealthIndicatorResult<Key>> {
    const check = this.healthIndicatorService.check(key);

    try {
      await this.redisClient.ping();
      return check.up();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Redis ping failed: ${message}`);
      return check.down(message);
    }
  }
}
