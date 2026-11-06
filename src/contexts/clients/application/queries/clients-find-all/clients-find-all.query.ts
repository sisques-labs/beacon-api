/**
 * Carries no input — lists every client, unfiltered (spec:
 * `client-authentication` "Listing shows metadata but never the secret or
 * its hash"). Structural marker class for `QueryBus` dispatch; there is no
 * logic to validate, so it has no dedicated spec (mirrors the port
 * interfaces' "no spec for trivial structural files" convention).
 */
export class ClientsFindAllQuery {}
