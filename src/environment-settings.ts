/**
 * Environment permission settings and sanitizers.
 * Machine-level permission switches (exec, See, Control) and consent modes.
 */
import type {
  ConsentMode,
  EnvironmentPermissionSettings,
  PushAuthority
} from './types.js';

export const ENV_PERMISSION_KEYS = [
  'execEnabled',
  'computerUseEnabled',
  'controlEnabled',
  'seeConsent',
  'controlConsent',
  'execConsent'
] as const;

export type EnvPermissionKey = (typeof ENV_PERMISSION_KEYS)[number];

const CONSENT_RANK: Record<ConsentMode, number> = { never: 0, session: 1, always: 2 };

const isConsentKey = (k: string): k is 'seeConsent' | 'controlConsent' | 'execConsent' =>
  k === 'seeConsent' || k === 'controlConsent' || k === 'execConsent';

/** Extract the permission subset from a broader settings object. */
export function permissionSubset(
  s: Record<string, unknown> | object
): EnvironmentPermissionSettings {
  const out: EnvironmentPermissionSettings = {};
  const rec = s as Record<string, unknown>;
  for (const k of ENV_PERMISSION_KEYS) {
    const v = rec[k];
    if (isConsentKey(k)) {
      if (v === 'always' || v === 'session' || v === 'never') out[k] = v;
    } else if (typeof v === 'boolean') {
      out[k] = v;
    }
  }
  return out;
}

/** Keep only well-typed permission keys from an untrusted frame. */
export function sanitizePermissions(raw: unknown): EnvironmentPermissionSettings {
  const out: EnvironmentPermissionSettings = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  const r = raw as Record<string, unknown>;
  for (const k of ENV_PERMISSION_KEYS) {
    const v = r[k];
    if (isConsentKey(k)) {
      if (v === 'always' || v === 'session' || v === 'never') out[k] = v;
    } else if (typeof v === 'boolean') {
      out[k] = v;
    }
  }
  return out;
}

/**
 * The patch to apply locally for a push from the hub: only the keys where the
 * pushed value is STRICTER than ours. Never enables a capability, never relaxes
 * a prompt.
 */
export function tighteningPatch(
  local: EnvironmentPermissionSettings,
  incoming: unknown
): Partial<EnvironmentPermissionSettings> {
  const pushed = sanitizePermissions(incoming);
  const patch: Partial<EnvironmentPermissionSettings> = {};
  for (const k of ENV_PERMISSION_KEYS) {
    const v = pushed[k];
    if (v === undefined) continue;
    if (isConsentKey(k)) {
      const cur = local[k] ?? 'never';
      if (CONSENT_RANK[v as ConsentMode] > CONSENT_RANK[cur]) patch[k] = v as ConsentMode;
    } else if (v === false && local[k] === true) {
      patch[k] = false;
    }
  }
  return patch;
}

/** Keys whose value differs between two snapshots, with the NEXT values. */
export function diffPermissions(
  prev: EnvironmentPermissionSettings,
  next: EnvironmentPermissionSettings
): EnvironmentPermissionSettings {
  const out: EnvironmentPermissionSettings = {};
  for (const k of ENV_PERMISSION_KEYS) {
    if (next[k] !== undefined && next[k] !== prev[k]) (out as Record<string, unknown>)[k] = next[k];
  }
  return out;
}

/**
 * For the keys a hub push mentions, our value where it differs.
 */
export function driftFromPush(
  incoming: unknown,
  mine: EnvironmentPermissionSettings
): EnvironmentPermissionSettings {
  const pushed = sanitizePermissions(incoming);
  const out: EnvironmentPermissionSettings = {};
  for (const k of ENV_PERMISSION_KEYS) {
    if (pushed[k] !== undefined && mine[k] !== undefined && pushed[k] !== mine[k]) {
      (out as Record<string, unknown>)[k] = mine[k];
    }
  }
  return out;
}

/**
 * The patch to apply locally for a push from the hub, by authority:
 * 'local' and 'step_up' pushes apply every well-typed key that differs (they may
 * loosen); anything else only where it is stricter (tighteningPatch).
 */
export function patchForPush(
  local: EnvironmentPermissionSettings,
  incoming: unknown,
  authority: PushAuthority | undefined
): Partial<EnvironmentPermissionSettings> {
  if (authority !== 'local' && authority !== 'step_up') return tighteningPatch(local, incoming);
  const pushed = sanitizePermissions(incoming);
  const patch: Partial<EnvironmentPermissionSettings> = {};
  for (const k of ENV_PERMISSION_KEYS) {
    const v = pushed[k];
    if (v !== undefined && v !== local[k]) (patch as Record<string, unknown>)[k] = v as never;
  }
  return patch;
}
