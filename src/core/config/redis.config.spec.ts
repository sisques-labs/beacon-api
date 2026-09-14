import { redisConfig } from '@core/config/redis.config';

describe('redisConfig', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.REDIS_HOST;
    delete process.env.REDIS_PORT;
    delete process.env.REDIS_PASSWORD;
    delete process.env.REDIS_DB;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('defaults port to 6379 and db to 0 with no password when only host is set', () => {
    process.env.REDIS_HOST = 'localhost';

    expect(redisConfig()).toEqual({
      host: 'localhost',
      port: 6379,
      password: undefined,
      db: 0,
    });
  });

  it('reads a custom port, password and db from env', () => {
    process.env.REDIS_HOST = 'redis.internal';
    process.env.REDIS_PORT = '6380';
    process.env.REDIS_PASSWORD = ' secret ';
    process.env.REDIS_DB = '2';

    const config = redisConfig();

    expect(config.host).toBe('redis.internal');
    expect(config.port).toBe(6380);
    expect(config.password).toBe('secret');
    expect(config.db).toBe(2);
  });
});
