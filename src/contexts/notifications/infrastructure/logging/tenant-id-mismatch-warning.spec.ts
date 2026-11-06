import { Logger } from '@nestjs/common';
import { vi } from 'vitest';

import { warnIfTenantIdMismatch } from '@contexts/notifications/infrastructure/logging/tenant-id-mismatch-warning';

const AUTHENTICATED_TENANT_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_TENANT_ID = '22222222-2222-4222-8222-222222222222';

describe('warnIfTenantIdMismatch', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs a warning when the body tenantId differs from the authenticated tenant', () => {
    const logger = new Logger('test');
    const warnSpy = vi
      .spyOn(logger, 'warn')
      .mockImplementation(() => undefined);

    warnIfTenantIdMismatch(logger, OTHER_TENANT_ID, AUTHENTICATED_TENANT_ID);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [message] = warnSpy.mock.calls[0] as [string];
    expect(message).toContain(OTHER_TENANT_ID);
    expect(message).toContain(AUTHENTICATED_TENANT_ID);
  });

  it('does not warn when the body tenantId matches the authenticated tenant', () => {
    const logger = new Logger('test');
    const warnSpy = vi
      .spyOn(logger, 'warn')
      .mockImplementation(() => undefined);

    warnIfTenantIdMismatch(
      logger,
      AUTHENTICATED_TENANT_ID,
      AUTHENTICATED_TENANT_ID,
    );

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('does not warn when no body tenantId was presented', () => {
    const logger = new Logger('test');
    const warnSpy = vi
      .spyOn(logger, 'warn')
      .mockImplementation(() => undefined);

    warnIfTenantIdMismatch(logger, undefined, AUTHENTICATED_TENANT_ID);

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('never includes an API key in the warning message', () => {
    const logger = new Logger('test');
    const warnSpy = vi
      .spyOn(logger, 'warn')
      .mockImplementation(() => undefined);

    warnIfTenantIdMismatch(logger, OTHER_TENANT_ID, AUTHENTICATED_TENANT_ID);

    const [message] = warnSpy.mock.calls[0] as [string];
    expect(message).not.toMatch(/bcn_/);
  });
});
