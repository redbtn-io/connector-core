/**
 * Local connector presence.
 * Enables co-installed connectors (Desktop, CLI) on the same machine to discover
 * each other, heartbeat, and negotiate capability ownership without clashing.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defaultMachineConfigDir } from './machine-key.js';
import type { PresenceRecord } from './types.js';

export const STALE_MS = 90_000;

export function presenceDir(dir = defaultMachineConfigDir()): string {
  return join(dir, 'connectors');
}

export function presenceFile(kind: string, dir = defaultMachineConfigDir()): string {
  return join(presenceDir(dir), `${kind}.json`);
}

/** Write/refresh this connector's presence record. Best-effort. */
export function writePresence(
  rec: Omit<PresenceRecord, 'ts'>,
  dir = defaultMachineConfigDir()
): void {
  try {
    mkdirSync(presenceDir(dir), { recursive: true });
    const full: PresenceRecord = { ...rec, ts: Date.now() };
    writeFileSync(presenceFile(rec.kind, dir), JSON.stringify(full), { mode: 0o600 });
  } catch {
    /* presence is best-effort */
  }
}

/** Remove this connector's presence record on shutdown. */
export function clearPresence(kind: string, dir = defaultMachineConfigDir()): void {
  try {
    rmSync(presenceFile(kind, dir), { force: true });
  } catch {
    /* ignore */
  }
}

/**
 * Read sibling connectors on this machine (excluding `selfKind`), dropping
 * stale records older than STALE_MS.
 */
export function readPeers(
  selfKind: string,
  dir = defaultMachineConfigDir(),
  now = Date.now()
): PresenceRecord[] {
  const pDir = presenceDir(dir);
  if (!existsSync(pDir)) return [];
  const peers: PresenceRecord[] = [];
  try {
    for (const f of readdirSync(pDir)) {
      if (!f.endsWith('.json')) continue;
      const kind = f.slice(0, -'.json'.length);
      if (kind === selfKind) continue;
      try {
        const rec = JSON.parse(readFileSync(join(pDir, f), 'utf8')) as PresenceRecord;
        if (typeof rec.ts === 'number' && now - rec.ts <= STALE_MS) {
          peers.push(rec);
        }
      } catch {
        /* skip unreadable/corrupt record */
      }
    }
  } catch {
    /* ignore read error */
  }
  return peers;
}

/** True if a live sibling connector already advertises `capability`. */
export function peerOwnsCapability(
  selfKind: string,
  capability: string,
  dir = defaultMachineConfigDir()
): boolean {
  return readPeers(selfKind, dir).some((p) => p.capabilities?.includes(capability));
}
