import { vi } from 'vitest';

import { authConfig } from '@core/config/auth.config';

describe('authConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('leaves jwtSecret undefined when AUTH_JWT_SECRET is unset', () => {
    delete process.env.AUTH_JWT_SECRET;

    expect(authConfig().jwtSecret).toBeUndefined();
  });

  it('reads jwtSecret from the environment', () => {
    process.env.AUTH_JWT_SECRET = 'super-secret';

    expect(authConfig().jwtSecret).toBe('super-secret');
  });
});
