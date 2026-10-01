import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  canonicalJSON,
  bodyHashOf,
  proofMessage,
  signProof,
  verifyProof,
  buildMachineProof,
  loadOrCreateMachineKey,
  machineKeyPath,
  machineProof,
  proofHeaderValue,
  sha256Hex,
  clearMachineKeyCache
} from '../dist/index.js';

const vector = JSON.parse(
  readFileSync(new URL('./fixtures/machine-proof-vector.json', import.meta.url), 'utf8')
);

test('canonicalJSON sorts keys recursively, keeps array order, no whitespace', () => {
  assert.equal(canonicalJSON(vector.settings.body), vector.settings.canonicalBody);
  assert.equal(
    canonicalJSON({ b: [{ z: 1, a: 2 }, 3], a: { d: null, c: 'x' } }),
    '{"a":{"c":"x","d":null},"b":[{"a":2,"z":1},3]}'
  );
  assert.equal(bodyHashOf(vector.settings.body), vector.settings.proof.bodyHash);
  assert.equal(bodyHashOf(undefined), '');
  assert.equal(bodyHashOf(null), '');
});

test('golden vector: byte-identical message and Ed25519 signature', () => {
  const key = { version: 1, alg: 'ed25519', ...vector.key, createdAt: 'x' };
  for (const which of ['register', 'settings']) {
    const want = vector[which].proof;
    assert.equal(proofMessage(want), vector[which].message);
    const got = signProof(key, {
      purpose: want.purpose,
      machineId: want.machineId,
      subject: want.subject,
      ts: want.ts,
      nonce: want.nonce,
      body: which === 'settings' ? vector.settings.body : undefined
    });
    assert.deepEqual(got, want);
    assert.equal(verifyProof(got), true);
  }
});

test('all 4 purposes sign and verify properly (register, settings, hub-link, hub-relay)', () => {
  const key = { version: 1, alg: 'ed25519', ...vector.key, createdAt: 'x' };
  for (const purpose of ['register', 'settings', 'hub-link', 'hub-relay']) {
    const proof = signProof(key, {
      purpose,
      machineId: 'mach-test-purpose',
      subject: 'sub-1',
      body: { test: true }
    });
    assert.equal(proof.purpose, purpose);
    assert.equal(verifyProof(proof), true);
  }
});

test('tampered proof or bodyHash fails verification', () => {
  const bad = { ...vector.register.proof, subject: 'attacker' };
  assert.equal(verifyProof(bad), false);

  const badBody = {
    ...vector.settings.proof,
    bodyHash: '00' + vector.settings.proof.bodyHash.slice(2)
  };
  assert.equal(verifyProof(badBody), false);
});

test('machine key file: loadOrCreateMachineKey creates 0600 file and re-reads', () => {
  clearMachineKeyCache();
  const dir = mkdtempSync(join(tmpdir(), 'core-mk-'));
  try {
    const k1 = loadOrCreateMachineKey(dir);
    assert.equal(k1.version, 1);
    assert.equal(k1.alg, 'ed25519');
    if (process.platform !== 'win32') {
      assert.equal(statSync(machineKeyPath(dir)).mode & 0o777, 0o600);
    }
    const k2 = loadOrCreateMachineKey(dir);
    assert.equal(k2.publicKey, k1.publicKey);

    const proof = machineProof(
      { purpose: 'register', machineId: 'mach-abc', subject: 'inst-1' },
      dir
    );
    assert.ok(proof);
    assert.equal(proof.publicKey, k1.publicKey);
    assert.equal(verifyProof(proof), true);

    const hdr = proofHeaderValue(proof);
    assert.equal(JSON.parse(Buffer.from(hdr, 'base64').toString('utf8')).sig, proof.sig);
  } finally {
    clearMachineKeyCache();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('machine key file: EEXIST collision keeps existing key', () => {
  clearMachineKeyCache();
  const dir = mkdtempSync(join(tmpdir(), 'core-mk-'));
  try {
    const existing = {
      version: 1,
      alg: 'ed25519',
      ...vector.key,
      createdAt: '2026-01-01T00:00:00.000Z'
    };
    writeFileSync(machineKeyPath(dir), JSON.stringify(existing), { mode: 0o600 });
    const loaded = loadOrCreateMachineKey(dir);
    assert.equal(loaded.publicKey, vector.key.publicKey);
  } finally {
    clearMachineKeyCache();
    rmSync(dir, { recursive: true, force: true });
  }
});
