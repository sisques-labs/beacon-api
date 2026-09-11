import { registerAs } from '@nestjs/config';

import { IDiscordConfig } from '@core/config/interfaces/discord-config.interface';

/**
 * Configuration for the outbound Discord webhook sender.
 *
 * `webhookUrl` is Beacon-side config only, NEVER sourced from an ingress
 * event payload — see design.md D3 (SSRF mitigation: the ingestion topic
 * has no auth, so a caller-supplied URL would be an open relay). v1 sends
 * every DISCORD notification to this single fixed destination.
 */
export const discordConfig = registerAs('discord', (): IDiscordConfig => ({
  webhookUrl: process.env.DISCORD_WEBHOOK_URL?.trim() || undefined,
}));
