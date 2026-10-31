import { IAuthenticatedClient } from '@contexts/notifications/application/ports/authenticated-client.interface';

export const CLIENT_AUTHENTICATION_PORT = Symbol('CLIENT_AUTHENTICATION_PORT');

/**
 * Resolves a presented API-key credential to its owning client (design.md
 * D14). The adapter behind this port is the ONLY place `notifications`
 * reaches the `clients` context, over the `QueryBus` (the anti-corruption
 * seam — `infrastructure/adapters/`). A future login/register flow replaces
 * only the adapter; the guard, decorator, and every handler that depends on
 * this port stay unchanged.
 *
 * `null` means "not authenticated", for any reason (missing, malformed,
 * unknown, mismatched, or revoked — D17). This method throws only on an
 * infrastructure failure, never for an authentication failure.
 */
export interface IClientAuthenticationPort {
  authenticate(
    credential: string | undefined,
  ): Promise<IAuthenticatedClient | null>;
}
