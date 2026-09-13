import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AxiosError, AxiosHeaders } from 'axios';
import { of, throwError } from 'rxjs';
import { Mocked, vi } from 'vitest';

import { DiscordWebhookNotificationSenderAdapter } from '@contexts/notifications/infrastructure/adapters/discord-webhook-notification-sender.adapter';
import { INotificationPrimitives } from '@contexts/notifications/domain/primitives/notification.primitives';

const NOTIFICATION: INotificationPrimitives = {
  id: '11111111-1111-4111-8111-111111111111',
  tenantId: '22222222-2222-4222-8222-222222222222',
  recipientUserId: '33333333-3333-4333-8333-333333333333',
  channel: 'DISCORD',
  status: 'PENDING',
  title: 'Plant watered',
  body: 'Your plant was watered successfully.',
  sourceService: 'gardenia-api',
  dedupeKey: 'gardenia:plant:1:watered',
  failureReason: null,
  sentAt: null,
  readAt: null,
  cancelledAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

function buildAxiosError(status: number): AxiosError {
  return new AxiosError(
    `Request failed with status code ${status}`,
    String(status),
    undefined,
    undefined,
    {
      status,
      statusText: String(status),
      headers: new AxiosHeaders(),
      config: { headers: new AxiosHeaders() },
      data: null,
    },
  );
}

describe('DiscordWebhookNotificationSenderAdapter', () => {
  let adapter: DiscordWebhookNotificationSenderAdapter;
  let configService: Mocked<ConfigService>;
  let httpService: Mocked<HttpService>;

  beforeEach(() => {
    configService = {
      getOrThrow: vi.fn().mockReturnValue({
        webhookUrl: 'https://discord.com/api/webhooks/123/abc',
      }),
    } as unknown as Mocked<ConfigService>;
    httpService = {
      post: vi.fn(),
    } as unknown as Mocked<HttpService>;
    adapter = new DiscordWebhookNotificationSenderAdapter(
      httpService,
      configService,
    );
  });

  it('posts to the configured webhook and returns success on a 2xx response', async () => {
    httpService.post.mockReturnValue(
      of({
        data: null,
        status: 204,
        statusText: 'No Content',
        headers: {},
        config: { headers: new AxiosHeaders() },
      }),
    );

    const result = await adapter.send(NOTIFICATION);

    expect(httpService.post).toHaveBeenCalledWith(
      'https://discord.com/api/webhooks/123/abc',
      expect.objectContaining({
        content: expect.stringContaining(NOTIFICATION.title),
      }),
    );
    const body = httpService.post.mock.calls[0][1] as { content: string };
    expect(body.content).toContain(NOTIFICATION.title);
    expect(body.content).toContain(NOTIFICATION.body);
    expect(result).toEqual({ success: true, failureReason: null });
  });

  it('returns failure with the status code when the response is non-2xx', async () => {
    httpService.post.mockReturnValue(throwError(() => buildAxiosError(500)));

    const result = await adapter.send(NOTIFICATION);

    expect(result.success).toBe(false);
    expect(result.failureReason).toContain('500');
  });

  it('returns failure with the error message on a network error', async () => {
    httpService.post.mockReturnValue(
      throwError(() => new Error('ECONNREFUSED')),
    );

    const result = await adapter.send(NOTIFICATION);

    expect(result).toEqual({
      success: false,
      failureReason: 'ECONNREFUSED',
    });
  });

  it('returns failure without calling the webhook when no webhook URL is configured', async () => {
    configService.getOrThrow.mockReturnValue({ webhookUrl: undefined });

    const result = await adapter.send(NOTIFICATION);

    expect(httpService.post).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.failureReason).toBe('DISCORD_WEBHOOK_URL is not configured');
  });
});
