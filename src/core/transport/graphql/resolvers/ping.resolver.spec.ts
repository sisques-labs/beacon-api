import { PingResolver } from '@core/transport/graphql/resolvers/ping.resolver';

describe('PingResolver', () => {
  it('returns "pong"', () => {
    const resolver = new PingResolver();

    expect(resolver.ping()).toBe('pong');
  });
});
