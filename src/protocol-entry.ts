/**
 * Browser-safe entry point for @redbtn/connector-core.
 *
 * Re-exports ONLY the pieces an MV3 extension service worker may bundle:
 * pure types, the permission-settings sanitizers, and the wire protocol
 * codecs. NO fs / os / node:crypto imports anywhere in this graph:
 *   - ./types.js                 — pure type definitions
 *   - ./environment-settings.js  — pure functions over those types
 *   - ./protocol.js              — JSON codecs + capability list
 * Deliberately excluded: machine-key / machine-id / machine-config /
 * canonical-json / machine-key (node:crypto), presence (node:fs).
 * The extension generates its Ed25519 identity with WebCrypto instead.
 */
export * from './types.js';
export * from './environment-settings.js';
export * from './protocol.js';
