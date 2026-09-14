import {
  HealthCheckResult,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { Mocked, vi } from 'vitest';

import { RedisHealthIndicator } from '@core/health/indicators/redis.health-indicator';
import { HealthController } from '@core/health/transport/rest/controllers/health.controller';

describe('HealthController', () => {
  let controller: HealthController;
  let health: Mocked<HealthCheckService>;
  let db: Mocked<TypeOrmHealthIndicator>;
  let redis: Mocked<RedisHealthIndicator>;

  beforeEach(() => {
    health = {
      check: vi.fn(),
    } as unknown as Mocked<HealthCheckService>;
    db = {
      pingCheck: vi.fn(),
    } as unknown as Mocked<TypeOrmHealthIndicator>;
    redis = {
      pingCheck: vi.fn(),
    } as unknown as Mocked<RedisHealthIndicator>;
    controller = new HealthController(health, db, redis);
  });

  describe('check() / live()', () => {
    it('returns status "ok"', () => {
      expect(controller.check().status).toBe('ok');
    });

    it('returns a valid ISO 8601 timestamp', () => {
      const result = controller.live();
      expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
    });

    it('returns exactly the keys [status, timestamp]', () => {
      expect(Object.keys(controller.live()).sort()).toEqual([
        'status',
        'timestamp',
      ]);
    });
  });

  describe('ready()', () => {
    it('delegates to HealthCheckService with database and redis pings', async () => {
      const result: HealthCheckResult = {
        status: 'ok',
        info: { database: { status: 'up' }, redis: { status: 'up' } },
        error: {},
        details: { database: { status: 'up' }, redis: { status: 'up' } },
      };
      health.check.mockResolvedValue(result);

      const response = await controller.ready();

      expect(health.check).toHaveBeenCalledWith([
        expect.any(Function),
        expect.any(Function),
      ]);
      expect(response).toBe(result);
    });

    it('invokes the database ping indicator', async () => {
      health.check.mockImplementation(async (indicators) => {
        for (const indicator of indicators) {
          await indicator();
        }
        return { status: 'ok', info: {}, error: {}, details: {} };
      });
      db.pingCheck.mockResolvedValue({ database: { status: 'up' } });
      redis.pingCheck.mockResolvedValue({ redis: { status: 'up' } });

      await controller.ready();

      expect(db.pingCheck).toHaveBeenCalledWith('database');
    });

    it('invokes the redis ping indicator', async () => {
      health.check.mockImplementation(async (indicators) => {
        for (const indicator of indicators) {
          await indicator();
        }
        return { status: 'ok', info: {}, error: {}, details: {} };
      });
      db.pingCheck.mockResolvedValue({ database: { status: 'up' } });
      redis.pingCheck.mockResolvedValue({ redis: { status: 'up' } });

      await controller.ready();

      expect(redis.pingCheck).toHaveBeenCalledWith('redis');
    });
  });
});
