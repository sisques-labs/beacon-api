import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';

import { INotificationSenderPort } from '@contexts/notifications/application/ports/notification-sender.port';
import { INotificationSendResult } from '@contexts/notifications/application/ports/notification-send-result.interface';
import { INotificationPrimitives } from '@contexts/notifications/domain/primitives/notification.primitives';
import { IDiscordConfig } from '@contexts/notifications/infrastructure/config/interfaces/discord-config.interface';

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

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

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
      await firstValueFrom(
        this.httpService.post(webhookUrl, {
          content: `**${notification.title}**\n${notification.body}`,
        }),
      );

      this.logger.log(
        `Notification ${notification.id} delivered to Discord successfully`,
      );
      return { success: true, failureReason: null };
    } catch (error) {
      const failureReason = this.extractFailureReason(error);
      this.logger.error(
        `Delivery failed for notification ${notification.id}: ${failureReason}`,
      );
      return { success: false, failureReason };
    }
  }

  private extractFailureReason(error: unknown): string {
    if (error instanceof AxiosError) {
      return error.response
        ? `Discord webhook responded with status ${error.response.status}`
        : error.message;
    }
    return error instanceof Error ? error.message : String(error);
  }
}
