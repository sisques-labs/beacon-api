import { ValueObject } from '@sisques-labs/nestjs-kit';

import { InvalidDiscordWebhookUrlException } from '@contexts/notifications/domain/exceptions/invalid-discord-webhook-url.exception';

/**
 * Validates and canonicalizes a Discord webhook URL for safe storage (D7/D8).
 *
 * SSRF allowlist algorithm (design.md "SSRF Validation Algorithm"):
 * 1. Reject overlong input, whitespace, control characters, and backslashes
 *    in the RAW string, before the WHATWG URL parser can normalize them away
 *    (the parser silently strips/rewrites some of these, which would let a
 *    disguised input slip through post-parse checks).
 * 2. Parse with `new URL(raw)`; a parse error is rejected.
 * 3. Reject any explicit scheme other than `https:`, userinfo, port, query
 *    string, or fragment.
 * 4. `hostname` must be an EXACT match for `discord.com` or `discordapp.com`
 *    — this alone rejects subdomains (`ptb.`, `canary.`), trailing dots,
 *    userinfo host-spoofing (`discord.com@evil.com` resolves host `evil.com`)
 *    and IP-literal hosts.
 * 5. `pathname` must match `/api/webhooks/{snowflake}/{token}`.
 * 6. The stored value is a canonical rebuild from the parsed parts, never the
 *    raw input string.
 */
export class DiscordWebhookUrlValueObject extends ValueObject<string> {
  static readonly MAX_LENGTH = 2048;

  private static readonly ALLOWED_HOSTS = new Set([
    'discord.com',
    'discordapp.com',
  ]);

  private static readonly UNSAFE_RAW_INPUT_PATTERN = /[\s\\\x00-\x1F\x7F]/;

  private static readonly WEBHOOK_PATH_PATTERN =
    /^\/api\/webhooks\/(\d{17,20})\/([A-Za-z0-9_-]{1,128})$/;

  private readonly _value: string;
  private readonly _webhookId: string;

  constructor(raw: string) {
    super();
    const { canonicalUrl, webhookId } = DiscordWebhookUrlValueObject.parse(raw);
    this._value = canonicalUrl;
    this._webhookId = webhookId;
  }

  get value(): string {
    return this._value;
  }

  /** Safe-to-log label that never exposes the host, path, or token. */
  redacted(): string {
    return `discord:webhook/${this._webhookId}`;
  }

  protected validate(): void {
    // Validation happens in the static `parse()` factory before the fields
    // are assigned, so an invalid instance is never constructed.
  }

  private static parse(raw: string): {
    canonicalUrl: string;
    webhookId: string;
  } {
    if (
      typeof raw !== 'string' ||
      raw.length === 0 ||
      raw.length > DiscordWebhookUrlValueObject.MAX_LENGTH ||
      DiscordWebhookUrlValueObject.UNSAFE_RAW_INPUT_PATTERN.test(raw)
    ) {
      throw new InvalidDiscordWebhookUrlException();
    }

    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw new InvalidDiscordWebhookUrlException();
    }

    if (
      url.protocol !== 'https:' ||
      url.username !== '' ||
      url.password !== '' ||
      url.port !== '' ||
      url.search !== '' ||
      url.hash !== ''
    ) {
      throw new InvalidDiscordWebhookUrlException();
    }

    if (!DiscordWebhookUrlValueObject.ALLOWED_HOSTS.has(url.hostname)) {
      throw new InvalidDiscordWebhookUrlException();
    }

    const match = DiscordWebhookUrlValueObject.WEBHOOK_PATH_PATTERN.exec(
      url.pathname,
    );
    if (!match) {
      throw new InvalidDiscordWebhookUrlException();
    }

    const [, webhookId, token] = match;
    return {
      canonicalUrl: `https://${url.hostname}/api/webhooks/${webhookId}/${token}`,
      webhookId,
    };
  }
}
