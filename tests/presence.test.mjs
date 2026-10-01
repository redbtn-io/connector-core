import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  writePresence,
  clearPresence,
  readPeers,
  peerOwnsCapability,
  STALE_MS
} from '../dist/index.js';

test('presence: write, read peers, capability ownership, clear', () => {
  const dir = mkdtempSync(join(tmpdir(), 'core-presence-'));
  try {
    writePresence(
      {
        kind: 'desktop-agent',
        installId: 'desk-123',
        machineId: 'mach-123',
        capabilities: ['computer', 'exec'],
        pid: 1234
      },
      dir
    );

    const cliPeers = readPeers('cli', dir);
    assert.equal(cliPeers.length, 1);
    assert.equal(cliPeers[0].kind, 'desktop-agent');
    assert.equal(cliPeers[0].installId, 'desk-123');

    // Self kind is excluded
    const deskPeers = readPeers('desktop-agent', dir);
    assert.equal(deskPeers.length, 0);

    // Capability check
    assert.equal(peerOwnsCapability('cli', 'computer', dir), true);
    assert.equal(peerOwnsCapability('cli', 'tts', dir), false);

    // Stale records are dropped
    const stalePeers = readPeers('cli', dir, Date.now() + STALE_MS + 5000);
    assert.equal(stalePeers.length, 0);

    // Clear presence
    clearPresence('desktop-agent', dir);
    assert.equal(readPeers('cli', dir).length, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
