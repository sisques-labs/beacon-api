import { discordConfig } from '@core/config/discord.config';

describe('discordConfig', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.DISCORD_WEBHOOK_URL;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('defaults webhookUrl to undefined when unset', () => {
    expect(discordConfig().webhookUrl).toBeUndefined();
  });

  it('reads DISCORD_WEBHOOK_URL when set', () => {
    process.env.DISCORD_WEBHOOK_URL =
      'https://discord.com/api/webhooks/123/abc';

    expect(discordConfig().webhookUrl).toBe(
      'https://discord.com/api/webhooks/123/abc',
    );
  });

  it('trims surrounding whitespace', () => {
    process.env.DISCORD_WEBHOOK_URL =
      '  https://discord.com/api/webhooks/123/abc  ';

    expect(discordConfig().webhookUrl).toBe(
      'https://discord.com/api/webhooks/123/abc',
    );
  });
});
