import { HealthIndicatorService } from '@nestjs/terminus';
import { Mocked, vi } from 'vitest';

import { RedisHealthIndicator } from '@core/health/indicators/redis.health-indicator';

interface FakeRedisClient {
  ping(): Promise<string>;
}

describe('RedisHealthIndicator', () => {
  let indicator: RedisHealthIndicator;
  let redisClient: Mocked<FakeRedisClient>;
  let healthIndicatorService: HealthIndicatorService;

  beforeEach(() => {
    redisClient = { ping: vi.fn() } as unknown as Mocked<FakeRedisClient>;
    healthIndicatorService = new HealthIndicatorService();
    indicator = new RedisHealthIndicator(
      redisClient as never,
      healthIndicatorService,
    );
  });

  it('reports "up" when the ping succeeds', async () => {
    redisClient.ping.mockResolvedValue('PONG');

    const result = await indicator.pingCheck('redis');

    expect(result).toEqual({ redis: { status: 'up' } });
    expect(redisClient.ping).toHaveBeenCalledTimes(1);
  });

  it('reports "down" with the error message when the ping rejects', async () => {
    redisClient.ping.mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await indicator.pingCheck('redis');

    expect(result).toEqual({
      redis: { status: 'down', message: 'ECONNREFUSED' },
    });
  });
});
