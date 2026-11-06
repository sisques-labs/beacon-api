import { Logger } from '@nestjs/common';
import { Mocked, vi } from 'vitest';

import {
  readApiKeyHeaderValue,
  warnIfApiKeyMissing,
} from '@contexts/notifications/infrastructure/logging/api-key-readiness-warning';

describe('warnIfApiKeyMissing', () => {
  let logger: Mocked<Logger>;

  beforeEach(() => {
    logger = { warn: vi.fn() } as unknown as Mocked<Logger>;
  });

  it('logs a warning when no API key was presented', () => {
    warnIfApiKeyMissing(logger, undefined, 'tenant-1');

    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('includes the tenantId in the warning when one is given', () => {
    warnIfApiKeyMissing(logger, undefined, 'tenant-1');

    const [message] = logger.warn.mock.calls[0] as [string];
    expect(message).toContain('tenant-1');
  });

  it('logs a warning with no tenantId suffix when none is given', () => {
    warnIfApiKeyMissing(logger, undefined);

    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('never logs the presented API key when one is present', () => {
    warnIfApiKeyMissing(logger, 'bcn_deadbeefdeadbeef_secret', 'tenant-1');

    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('does not warn when a key was presented', () => {
    warnIfApiKeyMissing(logger, 'some-key', 'tenant-1');

    expect(logger.warn).not.toHaveBeenCalled();
  });
});

describe('readApiKeyHeaderValue', () => {
  it('returns undefined when the header is absent', () => {
    expect(readApiKeyHeaderValue({})).toBeUndefined();
  });

  it('returns the header value when present as a string', () => {
    expect(readApiKeyHeaderValue({ 'x-api-key': 'the-key' })).toBe('the-key');
  });

  it('returns the first value when the header is an array', () => {
    expect(
      readApiKeyHeaderValue({ 'x-api-key': ['first-key', 'second-key'] }),
    ).toBe('first-key');
  });
});
