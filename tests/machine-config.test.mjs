import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  readMachineConfig,
  updateMachineConfig,
  machineConfigPath,
  execJailRoot
} from '../dist/index.js';

test('readMachineConfig returns defaults when file absent', () => {
  const dir = mkdtempSync(join(tmpdir(), 'core-cfg-'));
  try {
    const cfg = readMachineConfig(dir);
    assert.deepEqual(cfg.enabled, { environment: false, computer: false, control: false, exec: false });
    assert.deepEqual(cfg.exec, { allow: [], deny: [] });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('readMachineConfig handles pre-0.0.16 config without control field', () => {
  const dir = mkdtempSync(join(tmpdir(), 'core-cfg-'));
  try {
    writeFileSync(
      machineConfigPath(dir),
      JSON.stringify({ enabled: { environment: true, computer: true, exec: false } })
    );
    const cfg = readMachineConfig(dir);
    assert.equal(cfg.enabled.computer, true);
    assert.equal(cfg.enabled.control, true); // copies computer
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('updateMachineConfig persists merged config', () => {
  const dir = mkdtempSync(join(tmpdir(), 'core-cfg-'));
  try {
    updateMachineConfig({ enabled: { exec: true }, exec: { allow: ['node'] } }, dir);
    const cfg = readMachineConfig(dir);
    assert.equal(cfg.enabled.exec, true);
    assert.deepEqual(cfg.exec.allow, ['node']);
    assert.equal(execJailRoot(cfg), join(dir, '.redbtn', 'exec') !== undefined ? execJailRoot(cfg) : '');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('updateMachineConfig preserves unknown keys and handles service deletion with null', () => {
  const dir = mkdtempSync(join(tmpdir(), 'core-cfg-'));
  try {
    const p = machineConfigPath(dir);
    writeFileSync(p, JSON.stringify({ enabled: { exec: true }, desktopOnly: { keep: 1 } }));
    updateMachineConfig({ connect: { atLogin: true, services: { local: { label: 'l', backend: 'launchd', atLogin: true } } } }, dir);
    updateMachineConfig({ connect: { autostart: true } }, dir);

    let raw = JSON.parse(readFileSync(p, 'utf8'));
    assert.deepEqual(raw.desktopOnly, { keep: 1 });
    assert.equal(raw.enabled.exec, true);
    assert.equal(raw.connect.atLogin, true);
    assert.equal(raw.connect.autostart, true);
    assert.equal(raw.connect.services.local.backend, 'launchd');

    updateMachineConfig({ connect: { services: { local: null } } }, dir);
    raw = JSON.parse(readFileSync(p, 'utf8'));
    assert.deepEqual(raw.connect.services, {});
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

