import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';

import { INotificationDeliveryDestination } from '@contexts/notifications/application/ports/notification-delivery-destination.interface';
import { INotificationSenderPort } from '@contexts/notifications/application/ports/notification-sender.port';
import { INotificationSendResult } from '@contexts/notifications/application/ports/notification-send-result.interface';
import { INotificationPrimitives } from '@contexts/notifications/domain/primitives/notification.primitives';

/**
 * Discord incoming-webhook implementation of `INotificationSenderPort`.
 *
 * The destination URL is resolved per tenant by
 * `ResolveNotificationDeliveryDestinationService` and handed in by the
 * caller (design.md D1/D3 — no service-wide config, no `ConfigService`
 * dependency). `maxRedirects: 0` and a bounded `timeout` keep a redirect or
 * a hanging connection from turning a webhook POST into an SSRF pivot or a
 * stuck worker. Only `destination.logLabel` is ever logged — `url` MUST
 * NEVER reach a log call.
 */
@Injectable()
export class DiscordWebhookNotificationSenderAdapter implements INotificationSenderPort {
  private readonly logger = new Logger(
    DiscordWebhookNotificationSenderAdapter.name,
  );

  constructor(private readonly httpService: HttpService) {}

  async send(
    notification: INotificationPrimitives,
    destination: INotificationDeliveryDestination,
  ): Promise<INotificationSendResult> {
    this.logger.log(
      `Posting notification ${notification.id} to ${destination.logLabel}`,
    );

    try {
      await firstValueFrom(
        this.httpService.post(
          destination.url,
          { content: `**${notification.title}**\n${notification.body}` },
          { maxRedirects: 0, timeout: 10000 },
        ),
      );

      this.logger.log(
        `Notification ${notification.id} delivered to ${destination.logLabel} successfully`,
      );
      return { success: true, failureReason: null };
    } catch (error) {
      const failureReason = this.extractFailureReason(error);
      this.logger.error(
        `Delivery failed for notification ${notification.id} to ${destination.logLabel}: ${failureReason}`,
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
