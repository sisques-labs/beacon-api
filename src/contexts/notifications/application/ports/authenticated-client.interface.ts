/**
 * The resolved identity of a successfully authenticated client (design.md
 * D14 Data Flow: `ok → { clientId, tenantId }`). Own minimal shape — this
 * context never depends on `clients`' application types directly, only on
 * this port's contract.
 */
export interface IAuthenticatedClient {
  clientId: string;
  tenantId: string;
}
