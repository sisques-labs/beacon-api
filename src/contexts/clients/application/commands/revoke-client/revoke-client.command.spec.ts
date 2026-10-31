import { RevokeClientCommand } from '@contexts/clients/application/commands/revoke-client/revoke-client.command';

const VALID_CLIENT_ID = '11111111-1111-4111-8111-111111111111';

describe('RevokeClientCommand', () => {
  it('wraps clientId in a value object', () => {
    const command = new RevokeClientCommand({ clientId: VALID_CLIENT_ID });

    expect(command.clientId.value).toBe(VALID_CLIENT_ID);
  });

  it('throws when clientId is not a valid UUID', () => {
    expect(() => new RevokeClientCommand({ clientId: 'not-a-uuid' })).toThrow();
  });
});
