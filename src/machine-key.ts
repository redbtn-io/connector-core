/**
 * Machine key management and Ed25519 locality proofs.
 * Shared between redbtn Desktop, redbtn CLI, and Hub.
 */
import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  randomBytes,
  sign as cryptoSign,
  verify as cryptoVerify,
  type KeyObject
} from 'node:crypto';
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { bodyHashOf, canonicalJSON, sha256Hex } from './canonical-json.js';
import type {
  MachineKeyFile,
  MachineProof,
  MachineProofPurpose,
  ProofFields
} from './types.js';

export const MACHINE_PROOF_VERSION = 'redbtn-machine-proof/v1';
export const PROOF_VERSION = MACHINE_PROOF_VERSION;
export const MACHINE_PROOF_HEADER = 'x-redbtn-machine-proof';

/**
 * Standard cross-app config dir resolution:
 * REDBTN_CONFIG_DIR || (Windows ? %APPDATA%/redbtn : $XDG_CONFIG_HOME/redbtn || ~/.config/redbtn)
 */
export function defaultMachineConfigDir(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
  home: string = homedir()
): string {
  if (env.REDBTN_CONFIG_DIR) return env.REDBTN_CONFIG_DIR;
  if (platform === 'win32' && env.APPDATA) return join(env.APPDATA, 'redbtn');
  const base = env.XDG_CONFIG_HOME || join(home, '.config');
  return join(base, 'redbtn');
}

export function machineKeyDir(env: NodeJS.ProcessEnv = process.env): string {
  return defaultMachineConfigDir(env);
}

export function machineKeyPath(dir = machineKeyDir()): string {
  return join(dir, 'machine-key.json');
}

function isKeyFile(x: unknown): x is MachineKeyFile {
  const k = x as Partial<MachineKeyFile> | null;
  return (
    !!k &&
    k.alg === 'ed25519' &&
    typeof k.publicKey === 'string' &&
    typeof k.privateKey === 'string'
  );
}

let cached: { path: string; key: MachineKeyFile } | null = null;

export function clearMachineKeyCache(): void {
  cached = null;
}

/**
 * Read the machine key, creating it if absent.
 * Race-safe against concurrent processes (Desktop and CLI):
 * writes with 'wx' (exclusive create) and mode 0600. On EEXIST, reads the existing key.
 */
export function loadOrCreateMachineKey(dir = machineKeyDir()): MachineKeyFile {
  const p = machineKeyPath(dir);
  if (cached && cached.path === p) return cached.key;

  const read = (): MachineKeyFile | null => {
    try {
      const k = JSON.parse(readFileSync(p, 'utf8')) as unknown;
      return isKeyFile(k) ? k : null;
    } catch {
      return null;
    }
  };

  let existing = read();
  if (existing) {
    cached = { path: p, key: existing };
    return existing;
  }

  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const fresh: MachineKeyFile = {
    version: 1,
    alg: 'ed25519',
    publicKey: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
    privateKey: privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'),
    createdAt: new Date().toISOString()
  };

  mkdirSync(dir, { recursive: true });
  try {
    writeFileSync(p, JSON.stringify(fresh, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    try {
      chmodSync(p, 0o600);
    } catch {
      /* best-effort on Windows */
    }
    cached = { path: p, key: fresh };
    return fresh;
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === 'EEXIST') {
      // Another process created it; retry reading
      for (let i = 0; i < 20; i++) {
        const k = read();
        if (k) {
          cached = { path: p, key: k };
          return k;
        }
      }
    }
    throw err;
  }
}

/** Format the exact payload bytes that Ed25519 signs. */
export function proofMessage(
  f: Pick<MachineProof, 'purpose' | 'machineId' | 'subject' | 'ts' | 'nonce' | 'bodyHash'>
): string {
  return [
    MACHINE_PROOF_VERSION,
    `purpose:${f.purpose}`,
    `machine:${f.machineId}`,
    `subject:${f.subject}`,
    `ts:${f.ts}`,
    `nonce:${f.nonce}`,
    `body:${f.bodyHash}`
  ].join('\n');
}

function privateKeyObject(k: MachineKeyFile | Pick<MachineKeyFile, 'privateKey'>): KeyObject {
  return createPrivateKey({
    key: Buffer.from(k.privateKey, 'base64'),
    format: 'der',
    type: 'pkcs8'
  });
}

/** Sign a proof with an explicit key. */
export function signProof(
  key: Pick<MachineKeyFile, 'publicKey' | 'privateKey'>,
  f: {
    purpose: MachineProofPurpose;
    machineId: string;
    subject: string;
    body?: unknown;
    ts?: number;
    nonce?: string;
  }
): MachineProof {
  const base = {
    purpose: f.purpose,
    machineId: f.machineId,
    subject: f.subject,
    ts: f.ts ?? Date.now(),
    nonce: f.nonce ?? randomBytes(16).toString('hex'),
    bodyHash: bodyHashOf(f.body)
  };
  const msg = proofMessage(base);
  const sig = cryptoSign(null, Buffer.from(msg, 'utf8'), privateKeyObject(key)).toString('base64');
  return {
    v: 1,
    alg: 'ed25519',
    ...base,
    publicKey: key.publicKey,
    sig
  };
}

/** Alias for Desktop compatibility */
export const buildMachineProof = signProof;

/** Verify a proof's signature against its embedded publicKey. */
export function verifyProof(p: MachineProof): boolean {
  try {
    const pub = createPublicKey({
      key: Buffer.from(p.publicKey, 'base64'),
      format: 'der',
      type: 'spki'
    });
    return cryptoVerify(
      null,
      Buffer.from(proofMessage(p), 'utf8'),
      pub,
      Buffer.from(p.sig, 'base64')
    );
  } catch {
    return false;
  }
}

/** Convenience: sign a proof using the local machine key file. */
export function machineProof(
  f: {
    purpose: MachineProofPurpose;
    machineId: string;
    subject: string;
    body?: unknown;
    ts?: number;
    nonce?: string;
  },
  dir = machineKeyDir()
): MachineProof | null {
  try {
    const key = loadOrCreateMachineKey(dir);
    return signProof(key, f);
  } catch {
    return null;
  }
}

export function proofHeaderValue(p: MachineProof): string {
  return Buffer.from(JSON.stringify(p), 'utf8').toString('base64');
}

export { canonicalJSON, bodyHashOf, sha256Hex };
