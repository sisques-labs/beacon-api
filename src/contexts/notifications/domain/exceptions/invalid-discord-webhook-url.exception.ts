import { BaseException } from '@sisques-labs/nestjs-kit';

export class InvalidDiscordWebhookUrlException extends BaseException {
  constructor() {
    super(
      'The provided Discord webhook URL is invalid. It must be an https URL on discord.com or discordapp.com matching /api/webhooks/{id}/{token}, with no userinfo, port, query string, or fragment.',
    );
  }
}
