/**
 * Shared machine configuration (`configDir/machine.json`).
 * Holds machine-level enablement and exec sandbox policy shared between
 * redbtn Desktop and the redbtn CLI.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { defaultMachineConfigDir } from './machine-key.js';
import type { MachineConfig } from './types.js';

const DEFAULTS: MachineConfig = {
  enabled: { environment: false, computer: false, control: false, exec: false },
  exec: { allow: [], deny: [] }
};

export function machineConfigPath(dir = defaultMachineConfigDir()): string {
  return join(dir, 'machine.json');
}

/** Read the shared machine config, merged over defaults (never throws). */
export function readMachineConfig(dir = defaultMachineConfigDir()): MachineConfig {
  try {
    const p = machineConfigPath(dir);
    if (!existsSync(p)) return structuredClone(DEFAULTS);
    const raw = JSON.parse(readFileSync(p, 'utf8')) as {
      enabled?: Partial<MachineConfig['enabled']>;
      exec?: Partial<MachineConfig['exec']>;
      connect?: MachineConfig['connect'];
    };
    const enabled = { ...DEFAULTS.enabled, ...(raw.enabled ?? {}) };
    // Pre-0.0.16 files have no `control`: `computer` meant See+Control.
    if (typeof raw.enabled?.control !== 'boolean') enabled.control = enabled.computer;
    return {
      enabled,
      exec: {
        allow: Array.isArray(raw.exec?.allow) ? raw.exec!.allow : [],
        deny: Array.isArray(raw.exec?.deny) ? raw.exec!.deny : [],
        cwdRoot: raw.exec?.cwdRoot,
        egress: raw.exec?.egress
      },
      ...(raw.connect && typeof raw.connect === 'object' ? { connect: raw.connect } : {})
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

/** Deep-merge a patch into the shared machine config + persist (0600). */
export function updateMachineConfig(
  patch: {
    enabled?: Partial<MachineConfig['enabled']>;
    exec?: Partial<MachineConfig['exec']>;
    connect?: MachineConfig['connect'];
  },
  dir = defaultMachineConfigDir()
): MachineConfig {
  const cur = readMachineConfig(dir);
  const next: MachineConfig = {
    enabled: { ...cur.enabled, ...(patch.enabled ?? {}) },
    exec: {
      allow: Array.isArray(patch.exec?.allow) ? patch.exec!.allow : cur.exec.allow,
      deny: Array.isArray(patch.exec?.deny) ? patch.exec!.deny : cur.exec.deny,
      cwdRoot: patch.exec?.cwdRoot !== undefined ? patch.exec.cwdRoot : cur.exec.cwdRoot,
      egress: patch.exec?.egress !== undefined ? patch.exec.egress : cur.exec.egress
    },
    ...(cur.connect || patch.connect ? { connect: { ...(cur.connect ?? {}), ...(patch.connect ?? {}) } } : {})
  };

  mkdirSync(dir, { recursive: true });
  writeFileSync(machineConfigPath(dir), JSON.stringify(next, null, 2) + '\n', { mode: 0o600 });
  return next;
}

/**
 * The shared exec/file-op jail root. Honors `machine.json` `exec.cwdRoot`, else
 * `~/.redbtn/exec`.
 */
export function execJailRoot(cfg?: MachineConfig, home: string = homedir()): string {
  const c = cfg ?? readMachineConfig();
  return c.exec.cwdRoot || resolve(home, '.redbtn', 'exec');
}
