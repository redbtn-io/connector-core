/**
 * Stable per-PHYSICAL-MACHINE id — `mach-<16 hex>` = sha256(OS GUID) truncated.
 *
 * Derived from the OS machine GUID deterministically without coordination:
 *   linux  → /etc/machine-id (or /var/lib/dbus/machine-id)
 *   darwin → IOPlatformUUID (ioreg)
 *   win32  → HKLM\SOFTWARE\Microsoft\Cryptography MachineGuid (reg query)
 * Falls back to a persisted uuid in configDir/machine-id.
 */
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { defaultMachineConfigDir } from './machine-key.js';

let cached: string | null = null;

export function clearMachineIdCache(): void {
  cached = null;
}

export function rawMachineGuid(dir = defaultMachineConfigDir()): string {
  try {
    if (process.platform === 'linux') {
      for (const p of ['/etc/machine-id', '/var/lib/dbus/machine-id']) {
        if (existsSync(p)) {
          const v = readFileSync(p, 'utf8').trim();
          if (v) return v;
        }
      }
    } else if (process.platform === 'darwin') {
      const out = execFileSync('ioreg', ['-rd1', '-c', 'IOPlatformExpertDevice'], {
        encoding: 'utf8',
        timeout: 4000
      });
      const m = out.match(/IOPlatformUUID"\s*=\s*"([^"]+)"/);
      if (m?.[1]) return m[1];
    } else if (process.platform === 'win32') {
      const out = execFileSync(
        'reg',
        ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid'],
        { encoding: 'utf8', timeout: 4000 }
      );
      const m = out.match(/MachineGuid\s+REG_SZ\s+([A-Za-z0-9-]+)/);
      if (m?.[1]) return m[1];
    }
  } catch {
    /* fall through to shared file fallback */
  }

  const path = join(dir, 'machine-id');
  try {
    if (existsSync(path)) {
      const v = readFileSync(path, 'utf8').trim();
      if (v) return v;
    }
    mkdirSync(dirname(path), { recursive: true });
    const id = randomUUID();
    writeFileSync(path, id + '\n', { mode: 0o600 });
    return id;
  } catch {
    return randomUUID();
  }
}

/** `mach-<16 hex>` — stable per machine, identical across redbtn Desktop and redbtn CLI. */
export function getMachineId(dir = defaultMachineConfigDir()): string {
  if (cached) return cached;
  const hash = createHash('sha256').update(rawMachineGuid(dir)).digest('hex').slice(0, 16);
  cached = `mach-${hash}`;
  return cached;
}
