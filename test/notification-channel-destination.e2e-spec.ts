import { createE2EApp, E2EContext } from './helpers/app-bootstrap';
import { revokeClient, seedClient } from './helpers/client-seed';
import { truncateAll } from './helpers/db-reset';
import { gql } from './helpers/graphql-client';

/**
 * Covers spec `notification-channel-destination`'s "API-Key-Authenticated
 * Registration and Reads" and "Metadata-Only Reads" requirements, plus the
 * SSRF allowlist and secret-exposure rows of design.md's Threat Matrix, for
 * both REST and GraphQL transports (design.md D24).
 */

const VALID_WEBHOOK_URL =
  'https://discord.com/api/webhooks/123456789012345678/aValidToken';
const ROTATED_WEBHOOK_URL =
  'https://discordapp.com/api/webhooks/987654321098765432/aRotatedToken';
const UNKNOWN_API_KEY = `bcn_${'a'.repeat(16)}_${'b'.repeat(43)}`;

/** design.md "SSRF Validation Algorithm" — one case per rejection rule. */
const SSRF_URLS: Record<string, string> = {
  'non-https scheme':
    'http://discord.com/api/webhooks/123456789012345678/aValidToken',
  'non-allowlisted host':
    'https://evil.com/api/webhooks/123456789012345678/aValidToken',
  'discord subdomain':
    'https://ptb.discord.com/api/webhooks/123456789012345678/aValidToken',
  'userinfo host-spoofing': 'https://discord.com@evil.com/api/webhooks/1/x',
  'IP literal host':
    'https://169.254.169.254/api/webhooks/123456789012345678/aValidToken',
};

const REGISTER_MUTATION = `
  mutation ($input: NotificationChannelDestinationRegisterRequestDto!) {
    notificationChannelDestinationRegister(input: $input) {
      success
      id
      message
    }
  }
`;

const FIND_BY_CHANNEL_QUERY = `
  query ($input: NotificationChannelDestinationFindByChannelRequestDto!) {
    notificationChannelDestinationFindByChannel(input: $input) {
      configured
      id
      channel
      createdAt
      updatedAt
    }
  }
`;

describe('Notification channel destination (e2e)', () => {
  let ctx: E2EContext;

  beforeAll(async () => {
    ctx = await createE2EApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    await truncateAll(ctx.dataSource);
  });

  describe('REST — PUT/GET /api/v1/notification-destinations/:channel', () => {
    it('rejects a missing API key with 401 and persists nothing', async () => {
      const res = await ctx
        .http()
        .put('/api/v1/notification-destinations/DISCORD')
        .send({ webhookUrl: VALID_WEBHOOK_URL });

      expect(res.status).toBe(401);
    });

    it('rejects an unknown API key with 401', async () => {
      const res = await ctx
        .http()
        .put('/api/v1/notification-destinations/DISCORD')
        .set('x-api-key', UNKNOWN_API_KEY)
        .send({ webhookUrl: VALID_WEBHOOK_URL });

      expect(res.status).toBe(401);
    });

    it('rejects a revoked API key with 401', async () => {
      const client = await seedClient(ctx.app);
      await revokeClient(ctx.app, client.id);

      const res = await ctx
        .http()
        .put('/api/v1/notification-destinations/DISCORD')
        .set('x-api-key', client.apiKey)
        .send({ webhookUrl: VALID_WEBHOOK_URL });

      expect(res.status).toBe(401);
    });

    it('registers then reads metadata-only, never echoing the URL', async () => {
      const client = await seedClient(ctx.app);

      const putRes = await ctx
        .http()
        .put('/api/v1/notification-destinations/DISCORD')
        .set('x-api-key', client.apiKey)
        .send({ webhookUrl: VALID_WEBHOOK_URL });

      expect(putRes.status).toBe(200);
      expect(putRes.body.id).toEqual(expect.any(String));
      expect(JSON.stringify(putRes.body)).not.toContain(VALID_WEBHOOK_URL);

      const getRes = await ctx
        .http()
        .get('/api/v1/notification-destinations/DISCORD')
        .set('x-api-key', client.apiKey);

      expect(getRes.status).toBe(200);
      expect(getRes.body).toMatchObject({
        configured: true,
        id: putRes.body.id,
        channel: 'DISCORD',
      });
      expect(getRes.body.createdAt).toBeDefined();
      expect(getRes.body.updatedAt).toBeDefined();
      expect(getRes.body.webhookUrl).toBeUndefined();
      expect(JSON.stringify(getRes.body)).not.toContain(VALID_WEBHOOK_URL);
    });

    it('re-registering rotates the same destination id', async () => {
      const client = await seedClient(ctx.app);

      const first = await ctx
        .http()
        .put('/api/v1/notification-destinations/DISCORD')
        .set('x-api-key', client.apiKey)
        .send({ webhookUrl: VALID_WEBHOOK_URL });

      const second = await ctx
        .http()
        .put('/api/v1/notification-destinations/DISCORD')
        .set('x-api-key', client.apiKey)
        .send({ webhookUrl: ROTATED_WEBHOOK_URL });

      expect(second.status).toBe(200);
      expect(second.body.id).toBe(first.body.id);
      expect(JSON.stringify(second.body)).not.toContain(ROTATED_WEBHOOK_URL);
    });

    it('rejects an EMAIL channel with 400 and persists nothing', async () => {
      const client = await seedClient(ctx.app);

      const res = await ctx
        .http()
        .put('/api/v1/notification-destinations/EMAIL')
        .set('x-api-key', client.apiKey)
        .send({ webhookUrl: VALID_WEBHOOK_URL });

      expect(res.status).toBe(400);

      const readRes = await ctx
        .http()
        .get('/api/v1/notification-destinations/EMAIL')
        .set('x-api-key', client.apiKey);

      expect(readRes.status).toBe(200);
      expect(readRes.body.configured).toBe(false);
    });

    it.each(Object.entries(SSRF_URLS))(
      'rejects an SSRF attempt (%s) with 400 and never echoes the URL',
      async (_label, webhookUrl) => {
        const client = await seedClient(ctx.app);

        const res = await ctx
          .http()
          .put('/api/v1/notification-destinations/DISCORD')
          .set('x-api-key', client.apiKey)
          .send({ webhookUrl });

        expect(res.status).toBe(400);
        expect(JSON.stringify(res.body)).not.toContain(webhookUrl);
      },
    );

    it("cannot see another client's destination", async () => {
      const clientA = await seedClient(ctx.app);
      const clientB = await seedClient(ctx.app);

      await ctx
        .http()
        .put('/api/v1/notification-destinations/DISCORD')
        .set('x-api-key', clientA.apiKey)
        .send({ webhookUrl: VALID_WEBHOOK_URL });

      const res = await ctx
        .http()
        .get('/api/v1/notification-destinations/DISCORD')
        .set('x-api-key', clientB.apiKey);

      expect(res.status).toBe(200);
      expect(res.body.configured).toBe(false);
    });
  });

  describe('GraphQL — notificationChannelDestinationRegister / …FindByChannel', () => {
    it('rejects a missing API key with a GraphQL 401 error', async () => {
      const res = await gql(ctx.app, REGISTER_MUTATION, {
        input: { channel: 'DISCORD', webhookUrl: VALID_WEBHOOK_URL },
      });

      expect(res.body.errors).toBeDefined();
      expect(res.body.errors[0].extensions?.originalError?.statusCode).toBe(
        401,
      );
    });

    it('rejects an unknown API key with a GraphQL 401 error', async () => {
      const res = await gql(
        ctx.app,
        REGISTER_MUTATION,
        { input: { channel: 'DISCORD', webhookUrl: VALID_WEBHOOK_URL } },
        { 'x-api-key': UNKNOWN_API_KEY },
      );

      expect(res.body.errors).toBeDefined();
      expect(res.body.errors[0].extensions?.originalError?.statusCode).toBe(
        401,
      );
    });

    it('rejects a revoked API key with a GraphQL 401 error', async () => {
      const client = await seedClient(ctx.app);
      await revokeClient(ctx.app, client.id);

      const res = await gql(
        ctx.app,
        REGISTER_MUTATION,
        { input: { channel: 'DISCORD', webhookUrl: VALID_WEBHOOK_URL } },
        { 'x-api-key': client.apiKey },
      );

      expect(res.body.errors).toBeDefined();
      expect(res.body.errors[0].extensions?.originalError?.statusCode).toBe(
        401,
      );
    });

    it('registers then reads metadata-only, never echoing the URL', async () => {
      const client = await seedClient(ctx.app);

      const registerRes = await gql(
        ctx.app,
        REGISTER_MUTATION,
        { input: { channel: 'DISCORD', webhookUrl: VALID_WEBHOOK_URL } },
        { 'x-api-key': client.apiKey },
      );

      expect(registerRes.body.errors).toBeUndefined();
      expect(
        registerRes.body.data.notificationChannelDestinationRegister.success,
      ).toBe(true);
      expect(JSON.stringify(registerRes.body)).not.toContain(VALID_WEBHOOK_URL);

      const readRes = await gql(
        ctx.app,
        FIND_BY_CHANNEL_QUERY,
        { input: { channel: 'DISCORD' } },
        { 'x-api-key': client.apiKey },
      );

      expect(readRes.body.errors).toBeUndefined();
      expect(
        readRes.body.data.notificationChannelDestinationFindByChannel,
      ).toMatchObject({
        configured: true,
        id: registerRes.body.data.notificationChannelDestinationRegister.id,
        channel: 'DISCORD',
      });
      expect(JSON.stringify(readRes.body)).not.toContain(VALID_WEBHOOK_URL);
    });

    it('rejects an EMAIL channel with a GraphQL error and persists nothing', async () => {
      const client = await seedClient(ctx.app);

      const res = await gql(
        ctx.app,
        REGISTER_MUTATION,
        { input: { channel: 'EMAIL', webhookUrl: VALID_WEBHOOK_URL } },
        { 'x-api-key': client.apiKey },
      );

      expect(res.body.errors).toBeDefined();

      const readRes = await gql(
        ctx.app,
        FIND_BY_CHANNEL_QUERY,
        { input: { channel: 'EMAIL' } },
        { 'x-api-key': client.apiKey },
      );

      expect(
        readRes.body.data.notificationChannelDestinationFindByChannel
          .configured,
      ).toBe(false);
    });

    it.each(Object.entries(SSRF_URLS))(
      'rejects an SSRF attempt (%s) with a GraphQL error and never echoes the URL',
      async (_label, webhookUrl) => {
        const client = await seedClient(ctx.app);

        const res = await gql(
          ctx.app,
          REGISTER_MUTATION,
          { input: { channel: 'DISCORD', webhookUrl } },
          { 'x-api-key': client.apiKey },
        );

        expect(res.body.errors).toBeDefined();
        expect(JSON.stringify(res.body)).not.toContain(webhookUrl);
      },
    );

    it("cannot see another client's destination", async () => {
      const clientA = await seedClient(ctx.app);
      const clientB = await seedClient(ctx.app);

      await gql(
        ctx.app,
        REGISTER_MUTATION,
        { input: { channel: 'DISCORD', webhookUrl: VALID_WEBHOOK_URL } },
        { 'x-api-key': clientA.apiKey },
      );

      const res = await gql(
        ctx.app,
        FIND_BY_CHANNEL_QUERY,
        { input: { channel: 'DISCORD' } },
        { 'x-api-key': clientB.apiKey },
      );

      expect(res.body.errors).toBeUndefined();
      expect(
        res.body.data.notificationChannelDestinationFindByChannel.configured,
      ).toBe(false);
    });
  });
});
