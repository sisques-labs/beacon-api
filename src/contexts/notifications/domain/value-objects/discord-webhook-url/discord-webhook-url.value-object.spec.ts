import { InvalidDiscordWebhookUrlException } from '@contexts/notifications/domain/exceptions/invalid-discord-webhook-url.exception';
import { DiscordWebhookUrlValueObject } from '@contexts/notifications/domain/value-objects/discord-webhook-url/discord-webhook-url.value-object';

describe('DiscordWebhookUrlValueObject', () => {
  describe('accepted URLs', () => {
    it('accepts a valid discord.com webhook URL and stores it verbatim', () => {
      const url =
        'https://discord.com/api/webhooks/123456789012345678/aValidToken';

      expect(new DiscordWebhookUrlValueObject(url).value).toBe(url);
    });

    it('accepts a valid discordapp.com webhook URL (different id/token)', () => {
      const url =
        'https://discordapp.com/api/webhooks/98765432109876543/anotherToken_-123';

      expect(new DiscordWebhookUrlValueObject(url).value).toBe(url);
    });

    it('canonicalizes an uppercase host to lowercase (D8 canonical rebuild)', () => {
      const raw =
        'https://DISCORD.COM/api/webhooks/123456789012345678/aValidToken';

      expect(new DiscordWebhookUrlValueObject(raw).value).toBe(
        'https://discord.com/api/webhooks/123456789012345678/aValidToken',
      );
    });

    it('rebuilds the value from parsed parts rather than persisting the raw input', () => {
      const raw =
        'https://discord.com/api/webhooks/123456789012345678/aValidToken';

      const vo = new DiscordWebhookUrlValueObject(raw);

      expect(vo.value).toBe(
        `https://discord.com/api/webhooks/123456789012345678/aValidToken`,
      );
    });
  });

  describe('redacted()', () => {
    it('returns a redacted label containing only the webhook id', () => {
      const vo = new DiscordWebhookUrlValueObject(
        'https://discord.com/api/webhooks/123456789012345678/aValidToken',
      );

      expect(vo.redacted()).toBe('discord:webhook/123456789012345678');
    });

    it('never includes the token in the redacted label', () => {
      const vo = new DiscordWebhookUrlValueObject(
        'https://discord.com/api/webhooks/123456789012345678/aSecretToken',
      );

      expect(vo.redacted()).not.toContain('aSecretToken');
    });
  });

  describe('rejected URLs', () => {
    it.each([
      [
        'non-https scheme',
        'http://discord.com/api/webhooks/123456789012345678/aValidToken',
      ],
      [
        'non-allowlisted host',
        'https://evil.com/api/webhooks/123456789012345678/aValidToken',
      ],
      ['wrong webhook path', 'https://discord.com/some/other/path'],
      [
        'internal/private IP host',
        'https://169.254.169.254/api/webhooks/123456789012345678/aValidToken',
      ],
      [
        'userinfo host-spoofing (discord.com@evil.com)',
        'https://discord.com@evil.com/api/webhooks/123456789012345678/aValidToken',
      ],
      [
        'ptb. subdomain',
        'https://ptb.discord.com/api/webhooks/123456789012345678/aValidToken',
      ],
      [
        'canary. subdomain',
        'https://canary.discord.com/api/webhooks/123456789012345678/aValidToken',
      ],
      [
        'explicit port',
        'https://discord.com:8443/api/webhooks/123456789012345678/aValidToken',
      ],
      [
        'query string',
        'https://discord.com/api/webhooks/123456789012345678/aValidToken?x=1',
      ],
      [
        'fragment',
        'https://discord.com/api/webhooks/123456789012345678/aValidToken#frag',
      ],
      [
        'trailing dot on host',
        'https://discord.com./api/webhooks/123456789012345678/aValidToken',
      ],
      [
        'password-only userinfo',
        'https://:secret@discord.com/api/webhooks/123456789012345678/aValidToken',
      ],
      [
        'percent-encoded path segment in token',
        'https://discord.com/api/webhooks/123456789012345678/a%2Fb',
      ],
      [
        'backslash in raw input (pre-parse rejection)',
        'https://discord.com/api\\webhooks/123456789012345678/aValidToken',
      ],
      [
        'whitespace in raw input',
        'https://discord.com/api/webhooks/123456789012345678/a Valid Token',
      ],
      [
        'control character in raw input',
        'https://discord.com/api/webhooks/123456789012345678/aValid\tToken',
      ],
      ['not a URL at all', 'not-a-url'],
      ['empty string', ''],
      [
        'snowflake too short',
        'https://discord.com/api/webhooks/123/aValidToken',
      ],
      [
        'snowflake with non-digit characters',
        'https://discord.com/api/webhooks/12345678901234567a/aValidToken',
      ],
    ])('rejects: %s', (_label, raw) => {
      expect(() => new DiscordWebhookUrlValueObject(raw)).toThrow(
        InvalidDiscordWebhookUrlException,
      );
    });

    it('rejects a URL longer than 2048 characters', () => {
      const overlong = `https://discord.com/api/webhooks/123456789012345678/${'a'.repeat(2048)}`;

      expect(() => new DiscordWebhookUrlValueObject(overlong)).toThrow(
        InvalidDiscordWebhookUrlException,
      );
    });

    it('never echoes the rejected input in the exception message', () => {
      const secretLookingInput =
        'https://evil.com/api/webhooks/123456789012345678/superSecretValue';

      try {
        new DiscordWebhookUrlValueObject(secretLookingInput);
        throw new Error('expected constructor to throw');
      } catch (error) {
        expect((error as Error).message).not.toContain('superSecretValue');
        expect((error as Error).message).not.toContain('evil.com');
      }
    });
  });
});
