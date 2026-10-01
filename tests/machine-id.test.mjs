import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getMachineId, clearMachineIdCache } from '../dist/index.js';

test('getMachineId returns stable mach-<16 hex>', () => {
  clearMachineIdCache();
  const id1 = getMachineId();
  assert.match(id1, /^mach-[0-9a-f]{16}$/);

  const id2 = getMachineId();
  assert.equal(id1, id2);
});

test('getMachineId falls back to shared file when no OS guid', () => {
  clearMachineIdCache();
  const dir = mkdtempSync(join(tmpdir(), 'core-mach-'));
  try {
    const id = getMachineId(dir);
    assert.match(id, /^mach-[0-9a-f]{16}$/);
  } finally {
    clearMachineIdCache();
    rmSync(dir, { recursive: true, force: true });
  }
});
