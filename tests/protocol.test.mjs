import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  encodeClientMessage,
  parseClientMessage,
  encodeServerMessage,
  parseServerMessage,
  ALL_CAPABILITIES,
  PROTOCOL_VERSION
} from '../dist/index.js';

test('protocol capabilities and version', () => {
  assert.equal(PROTOCOL_VERSION, 1);
  assert.ok(ALL_CAPABILITIES.includes('exec'));
  assert.ok(ALL_CAPABILITIES.includes('computer'));
  assert.ok(ALL_CAPABILITIES.includes('terminal'));
});

test('encode and parse client messages', () => {
  const reg = {
    kind: 'register',
    id: 'reg-1',
    environmentKind: 'desktop-agent',
    name: 'test-box',
    machine: {
      installId: 'inst-1',
      hostname: 'test-box',
      platform: 'darwin',
      arch: 'arm64',
      osVersion: '14.0',
      appVersion: '0.1.0'
    },
    capabilities: ['exec', 'computer', 'terminal'],
    protocolVersion: 1
  };
  const json = encodeClientMessage(reg);
  assert.deepEqual(parseClientMessage(json), reg);

  const termRpcRes = {
    kind: 'terminal_rpc_result',
    id: 'rpc-1',
    status: 200,
    body: { ok: true }
  };
  assert.deepEqual(parseClientMessage(encodeClientMessage(termRpcRes)), termRpcRes);

  const termRpcEvent = {
    kind: 'terminal_rpc_event',
    id: 'rpc-2',
    event: { type: 'stdout', chunk: 'hello' }
  };
  assert.deepEqual(parseClientMessage(encodeClientMessage(termRpcEvent)), termRpcEvent);

  const termRpcDone = {
    kind: 'terminal_rpc_done',
    id: 'rpc-2'
  };
  assert.deepEqual(parseClientMessage(encodeClientMessage(termRpcDone)), termRpcDone);
});

test('encode and parse server messages', () => {
  const registered = {
    kind: 'registered',
    id: 'reg-1',
    environmentId: 'env-123'
  };
  const json = encodeServerMessage(registered);
  assert.deepEqual(parseServerMessage(json), registered);

  const termRpcReq = {
    kind: 'terminal_rpc',
    id: 'rpc-1',
    request: {
      method: 'GET',
      path: '/api/terminal/sessions'
    }
  };
  assert.deepEqual(parseServerMessage(encodeServerMessage(termRpcReq)), termRpcReq);

  const termRpcCancel = {
    kind: 'terminal_rpc_cancel',
    id: 'rpc-1'
  };
  assert.deepEqual(parseServerMessage(encodeServerMessage(termRpcCancel)), termRpcCancel);
});
