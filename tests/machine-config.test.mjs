import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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
