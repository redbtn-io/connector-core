/**
 * Browser-extension platform prep: the browser-safe /protocol entry, the
 * 'browser' capability + wire frames, and the local-only permission keys.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const entry = await import('../dist/protocol-entry.js');

test('browser-safe entry exports protocol + settings pieces', () => {
  assert.equal(typeof entry.parseClientMessage, 'function');
  assert.equal(typeof entry.parseServerMessage, 'function');
  assert.equal(typeof entry.sanitizePermissions, 'function');
  assert.equal(typeof entry.patchForPush, 'function');
  assert.ok(entry.ALL_CAPABILITIES.includes('browser'));
});

test('browser-safe entry graph has no node: imports', () => {
  for (const f of ['protocol-entry.js', 'protocol.js', 'environment-settings.js', 'types.js']) {
    const src = readFileSync(join(here, '..', 'dist', f), 'utf8');
    assert.ok(!/from\s+['"]node:/.test(src) && !/import\s+['"]node:/.test(src), `${f} must not import node: modules`);
  }
});

test('browser wire frames parse both directions', () => {
  const req = entry.parseServerMessage(JSON.stringify({ kind: 'browser', id: '1', request: { action: 'snapshot' } }));
  assert.equal(req.kind, 'browser');
  const res = entry.parseClientMessage(JSON.stringify({ kind: 'browser_result', id: '1', ok: true, result: {} }));
  assert.equal(res.kind, 'browser_result');
});

test('local-only browser keys never ride a hub push', () => {
  // sanitizePermissions drops them entirely: a hub frame cannot even tighten
  // tabScope/site lists/incognito — they are changed only in the extension.
  assert.deepEqual(
    entry.sanitizePermissions({ tabScope: 'any', siteAllow: ['x'], siteDeny: [], incognito: true, execEnabled: false }),
    { execEnabled: false },
  );
  assert.deepEqual(entry.LOCAL_ONLY_PERMISSION_KEYS, ['tabScope', 'siteAllow', 'siteDeny', 'incognito']);
  const patch = entry.patchForPush(
    { execEnabled: true },
    { tabScope: 'any', execEnabled: false },
    'local',
  );
  assert.deepEqual(patch, { execEnabled: false });
});
