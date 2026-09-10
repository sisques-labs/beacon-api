import { registerAs } from '@nestjs/config';

/**
 * Verification-only: this service never signs tokens, only trusts ones
 * Sisques Account already issued. `jwtSecret` stays `undefined` (rather than
 * defaulted) when unset — `AuthClientModule` still boots so `JwtAuthGuard`
 * is always importable, it just throws the first time a route actually
 * verifies a token, matching this service's opt-in choice not to fail boot
 * for a service that never integrates with the platform.
 */
export const authConfig = registerAs('auth', () => ({
  jwtSecret: process.env.AUTH_JWT_SECRET,
}));
