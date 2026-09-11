import { ConfigService } from '@nestjs/config';
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

describe('DiscordWebhookNotificationSenderAdapter', () => {
  let adapter: DiscordWebhookNotificationSenderAdapter;
  let configService: Mocked<ConfigService>;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    configService = {
      getOrThrow: vi.fn().mockReturnValue({
        webhookUrl: 'https://discord.com/api/webhooks/123/abc',
      }),
    } as unknown as Mocked<ConfigService>;
    adapter = new DiscordWebhookNotificationSenderAdapter(configService);
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('posts to the configured webhook and returns success on a 2xx response', async () => {
    fetchSpy.mockResolvedValue(
      new Response(null, { status: 204 }) as unknown as Response,
    );

    const result = await adapter.send(NOTIFICATION);

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://discord.com/api/webhooks/123/abc',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      }),
    );
    const body = JSON.parse(
      (fetchSpy.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.content).toContain(NOTIFICATION.title);
    expect(body.content).toContain(NOTIFICATION.body);
    expect(result).toEqual({ success: true, failureReason: null });
  });

  it('returns failure with the status code when the response is non-2xx', async () => {
    fetchSpy.mockResolvedValue(
      new Response(null, { status: 500 }) as unknown as Response,
    );

    const result = await adapter.send(NOTIFICATION);

    expect(result.success).toBe(false);
    expect(result.failureReason).toContain('500');
  });

  it('returns failure with the error message on a network error', async () => {
    fetchSpy.mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await adapter.send(NOTIFICATION);

    expect(result).toEqual({
      success: false,
      failureReason: 'ECONNREFUSED',
    });
  });

  it('returns failure without calling fetch when no webhook URL is configured', async () => {
    configService.getOrThrow.mockReturnValue({ webhookUrl: undefined });

    const result = await adapter.send(NOTIFICATION);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.failureReason).toBe('DISCORD_WEBHOOK_URL is not configured');
  });
});
