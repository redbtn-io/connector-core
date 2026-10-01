/**
 * Wire protocol codecs and serialization helpers (/ws/desktop).
 */
import type {
  AgentCapability,
  ClientMessage,
  ServerMessage
} from './types.js';

export const PROTOCOL_VERSION = 1;

export const ALL_CAPABILITIES: readonly AgentCapability[] = [
  'exec',
  'alert',
  'tts',
  'chat',
  'computer',
  'terminal'
] as const;

export function encodeClientMessage(msg: ClientMessage): string {
  return JSON.stringify(msg);
}

export function parseClientMessage(raw: string | Buffer): ClientMessage {
  const text = typeof raw === 'string' ? raw : raw.toString('utf8');
  const parsed = JSON.parse(text) as { kind?: unknown };
  if (!parsed || typeof parsed !== 'object' || typeof parsed.kind !== 'string') {
    throw new Error('Invalid client message: missing kind');
  }
  return parsed as ClientMessage;
}

export function encodeServerMessage(msg: ServerMessage): string {
  return JSON.stringify(msg);
}

export function parseServerMessage(raw: string | Buffer): ServerMessage {
  const text = typeof raw === 'string' ? raw : raw.toString('utf8');
  const parsed = JSON.parse(text) as { kind?: unknown };
  if (!parsed || typeof parsed !== 'object' || typeof parsed.kind !== 'string') {
    throw new Error('Invalid server message: missing kind');
  }
  return parsed as ServerMessage;
}
