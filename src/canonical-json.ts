/**
 * Canonical JSON serialization + body hashing.
 * Deterministic JSON representation with recursively sorted keys,
 * used for signing machine proof bodies across Desktop, CLI, and Hub.
 */
import { createHash } from 'node:crypto';

export function canonicalJSON(value: unknown): string {
  const norm = (x: unknown): unknown => {
    if (Array.isArray(x)) return x.map(norm);
    if (x && typeof x === 'object') {
      const o: Record<string, unknown> = {};
      for (const k of Object.keys(x as object).sort()) {
        const val = (x as Record<string, unknown>)[k];
        if (val !== undefined) o[k] = norm(val);
      }
      return o;
    }
    return x;
  };
  return JSON.stringify(norm(value));
}

export function sha256Hex(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

export function bodyHashOf(body: unknown): string {
  if (body === undefined || body === null) return '';
  return sha256Hex(canonicalJSON(body));
}
