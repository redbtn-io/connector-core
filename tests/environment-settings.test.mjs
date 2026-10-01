import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  diffPermissions,
  patchForPush,
  driftFromPush,
  permissionSubset,
  sanitizePermissions,
  tighteningPatch
} from '../dist/index.js';

const local = {
  execEnabled: true,
  computerUseEnabled: false,
  controlEnabled: true,
  seeConsent: 'session',
  controlConsent: 'always',
  execConsent: 'never'
};

test('tighteningPatch: a push may turn a switch OFF', () => {
  assert.deepEqual(tighteningPatch(local, { execEnabled: false, controlEnabled: false }), {
    execEnabled: false,
    controlEnabled: false
  });
});

test('tighteningPatch: a push may NEVER turn a switch on', () => {
  assert.deepEqual(tighteningPatch(local, { computerUseEnabled: true }), {});
});

test('tighteningPatch: a push may make a consent prompt stricter, never looser', () => {
  assert.deepEqual(
    tighteningPatch(local, { seeConsent: 'always', execConsent: 'session' }),
    { seeConsent: 'always', execConsent: 'session' }
  );
  assert.deepEqual(tighteningPatch(local, { controlConsent: 'never', seeConsent: 'never' }), {});
});

test('sanitizePermissions: junk in a push is ignored', () => {
  assert.deepEqual(
    sanitizePermissions({ execAllowReal: true, execEnabled: 'yes', seeConsent: 'maybe', controlEnabled: false }),
    { controlEnabled: false }
  );
  assert.deepEqual(tighteningPatch(local, { execAllowReal: false }), {});
});

test('driftFromPush: reports back what differs from a push', () => {
  assert.deepEqual(driftFromPush({ execEnabled: false, seeConsent: 'session' }, local), {
    execEnabled: true
  });
  assert.deepEqual(driftFromPush({}, local), {});
});

test('diffPermissions: reports only changed keys', () => {
  const next = { ...local, execConsent: 'always' };
  assert.deepEqual(diffPermissions(local, next), { execConsent: 'always' });
  assert.deepEqual(
    Object.keys(permissionSubset({ ...local, deviceName: 'x', execAllowReal: true })).sort(),
    ['computerUseEnabled', 'controlConsent', 'controlEnabled', 'execConsent', 'execEnabled', 'seeConsent']
  );
});

test('patchForPush: local or step_up push may loosen', () => {
  const loc = { execEnabled: false, computerUseEnabled: false, seeConsent: 'always', execConsent: 'always' };
  const incoming = { execEnabled: true, seeConsent: 'never', execConsent: 'always', bogus: 1, execAllowReal: true };
  for (const authority of ['local', 'step_up']) {
    assert.deepEqual(patchForPush(loc, incoming, authority), { execEnabled: true, seeConsent: 'never' });
  }
});

test('patchForPush: remote or unattested push is tighten-only', () => {
  const loc = { execEnabled: true, controlEnabled: false, seeConsent: 'never' };
  const incoming = { execEnabled: false, controlEnabled: true, seeConsent: 'always' };
  for (const authority of ['remote', undefined, 'bogus']) {
    assert.deepEqual(patchForPush(loc, incoming, authority), { execEnabled: false, seeConsent: 'always' });
  }
});
