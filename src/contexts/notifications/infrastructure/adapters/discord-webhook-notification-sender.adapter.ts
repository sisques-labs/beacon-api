import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { IDiscordConfig } from '@core/config/interfaces/discord-config.interface';

import { INotificationSenderPort } from '@contexts/notifications/application/ports/notification-sender.port';
import { INotificationSendResult } from '@contexts/notifications/application/ports/notification-send-result.interface';
import { INotificationPrimitives } from '@contexts/notifications/domain/primitives/notification.primitives';

/**
 * Discord incoming-webhook implementation of `INotificationSenderPort`.
 *
 * The webhook URL is always read from `discord.webhookUrl` (Beacon-side
 * config) — see design.md D3. It is NEVER taken from the notification
 * payload, since the unauthenticated ingestion topic would otherwise be an
 * SSRF sink for any caller-supplied URL. v1 posts every DISCORD notification
 * to this single fixed destination.
 */
@Injectable()
export class DiscordWebhookNotificationSenderAdapter implements INotificationSenderPort {
  private readonly logger = new Logger(
    DiscordWebhookNotificationSenderAdapter.name,
  );

  constructor(private readonly configService: ConfigService) {}

  async send(
    notification: INotificationPrimitives,
  ): Promise<INotificationSendResult> {
    const { webhookUrl } =
      this.configService.getOrThrow<IDiscordConfig>('discord');

    if (!webhookUrl) {
      this.logger.error(
        `Cannot deliver notification ${notification.id}: DISCORD_WEBHOOK_URL is not configured`,
      );
      return {
        success: false,
        failureReason: 'DISCORD_WEBHOOK_URL is not configured',
      };
    }

    this.logger.log(
      `Posting notification ${notification.id} to Discord webhook`,
    );

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `**${notification.title}**\n${notification.body}`,
        }),
      });

      if (!response.ok) {
        const failureReason = `Discord webhook responded with status ${response.status}`;
        this.logger.warn(
          `Delivery failed for notification ${notification.id}: ${failureReason}`,
        );
        return { success: false, failureReason };
      }

      this.logger.log(
        `Notification ${notification.id} delivered to Discord successfully`,
      );
      return { success: true, failureReason: null };
    } catch (error) {
      const failureReason =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Delivery failed for notification ${notification.id}: ${failureReason}`,
      );
      return { success: false, failureReason };
    }
  }
}
