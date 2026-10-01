/**
 * @redbtn/connector-core shared types.
 * Pure TypeScript definitions for machine identity, Ed25519 proofs,
 * permissions, presence, and gateway wire messages.
 */

// ---------------------------------------------------------------------------
// Machine Proof & Machine Key
// ---------------------------------------------------------------------------

export type MachineProofPurpose = 'register' | 'settings' | 'hub-link' | 'hub-relay';
export type ProofPurpose = MachineProofPurpose;

export interface MachineKeyFile {
  version: 1;
  alg: 'ed25519';
  publicKey: string;
  privateKey: string;
  createdAt: string;
}

export interface MachineProof {
  v: 1;
  alg: 'ed25519';
  purpose: MachineProofPurpose;
  machineId: string;
  subject: string;
  ts: number;
  nonce: string;
  bodyHash: string;
  /** base64 SPKI DER */
  publicKey: string;
  /** base64 Ed25519 signature */
  sig: string;
}

export interface ProofFields {
  purpose: MachineProofPurpose;
  machineId: string;
  subject: string;
  ts: number;
  nonce: string;
  bodyHash: string;
}

// ---------------------------------------------------------------------------
// Machine Identity & Config
// ---------------------------------------------------------------------------

export interface MachineInfo {
  installId: string;
  machineId?: string;
  hostname: string;
  platform: NodeJS.Platform | string;
  arch: string;
  osVersion: string;
  appVersion: string;
}

export interface ConnectServiceRecord {
  label: string;
  backend: 'launchd' | 'systemd' | 'schtasks' | 'detached';
  atLogin: boolean;
  name?: string;
  cliVersion?: string;
  installedAt?: string;
}

export interface ConnectSettings {
  autostart?: boolean;
  atLogin?: boolean;
  services?: Record<string, ConnectServiceRecord>;
}

export interface MachineConfig {
  enabled: {
    environment: boolean;
    computer: boolean;
    control: boolean;
    exec: boolean;
  };
  exec: {
    allow: string[];
    deny: string[];
    cwdRoot?: string;
    egress?: 'allow' | 'deny' | 'allowlist';
  };
  connect?: ConnectSettings;
}

// ---------------------------------------------------------------------------
// Local Connector Presence
// ---------------------------------------------------------------------------

export interface PresenceRecord {
  kind: string; // 'cli' | 'desktop-agent' | ...
  installId: string;
  machineId: string;
  capabilities: string[];
  pid: number;
  ts: number; // epoch ms
}

// ---------------------------------------------------------------------------
// Environment Permissions
// ---------------------------------------------------------------------------

export type ConsentMode = 'never' | 'session' | 'always';
export type PushAuthority = 'local' | 'step_up' | 'remote';

export interface EnvironmentPermissionSettings {
  execEnabled?: boolean;
  computerUseEnabled?: boolean;
  controlEnabled?: boolean;
  seeConsent?: ConsentMode;
  controlConsent?: ConsentMode;
  execConsent?: ConsentMode;
}

// ---------------------------------------------------------------------------
// Gateway Wire Protocol (/ws/desktop)
// ---------------------------------------------------------------------------

export type AgentCapability = 'exec' | 'alert' | 'tts' | 'chat' | 'computer' | 'terminal';

export interface MachineTrust {
  status: 'local' | 'remote' | 'unverified';
  reason?: string;
}

export interface MachineEnvironmentView {
  environmentId: string;
  name: string;
  machineId?: string;
  connectors: Array<{
    installId: string;
    kind: string;
    capabilities: string[];
    live: boolean;
    ts?: number;
  }>;
}

export interface ProtocolError {
  code: string;
  message: string;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  truncated: boolean;
}

// Outbound (Client -> Gateway)
export interface RegisterMessage {
  kind: 'register';
  id: string;
  environmentKind: 'desktop-agent';
  name: string;
  machine: MachineInfo;
  capabilities: AgentCapability[];
  protocolVersion: number;
  environmentSettings?: EnvironmentPermissionSettings;
  machineProof?: MachineProof;
}

export interface PingMessage {
  kind: 'ping';
  id: string;
  ts: number;
}

export interface ExecResultMessage {
  kind: 'exec_result';
  id: string;
  ok: boolean;
  result?: ExecResult;
  error?: ProtocolError;
}

export interface ExecChunkMessage {
  kind: 'exec_chunk';
  id: string;
  stream: 'stdout' | 'stderr';
  chunk: string;
  seq: number;
}

export interface AckMessage {
  kind: 'ack';
  id: string;
  ok: boolean;
  error?: ProtocolError;
}

export interface ChatSendMessage {
  kind: 'chat_send';
  id: string;
  text: string;
  streamId?: string;
}

export interface ComputerResultMessage {
  kind: 'computer_result';
  id: string;
  ok: boolean;
  result?: Record<string, unknown>;
  error?: ProtocolError;
}

export interface SettingsResultMessage {
  kind: 'settings_result';
  id: string;
  ok: boolean;
  settings?: Record<string, unknown>;
  changed?: string[];
  error?: ProtocolError;
}

export interface SftpResultMessage {
  kind: 'sftp_result';
  id: string;
  ok: boolean;
  result?: Record<string, unknown>;
  error?: ProtocolError;
}

export interface TerminalRpcResultMessage {
  kind: 'terminal_rpc_result';
  id: string;
  status: number;
  body: unknown;
}

export interface TerminalRpcEventMessage {
  kind: 'terminal_rpc_event';
  id: string;
  event: unknown;
}

export interface TerminalRpcDoneMessage {
  kind: 'terminal_rpc_done';
  id: string;
}

export type ClientMessage =
  | RegisterMessage
  | PingMessage
  | ExecResultMessage
  | ExecChunkMessage
  | AckMessage
  | ChatSendMessage
  | ComputerResultMessage
  | SettingsResultMessage
  | SftpResultMessage
  | TerminalRpcResultMessage
  | TerminalRpcEventMessage
  | TerminalRpcDoneMessage;

// Inbound (Gateway -> Client)
export interface RegisteredMessage {
  kind: 'registered';
  id: string;
  environmentId: string;
  heartbeatIntervalMs?: number;
  capabilities?: AgentCapability[];
  machineTrust?: MachineTrust;
  environment?: MachineEnvironmentView;
  environmentSettings?: EnvironmentPermissionSettings;
}

export interface ErrorMessage {
  kind: 'error';
  id?: string;
  code: string;
  message: string;
  fatal?: boolean;
}

export interface PongMessage {
  kind: 'pong';
  id: string;
  ts: number;
}

export interface AlertMessage {
  kind: 'alert';
  id: string;
  title: string;
  body: string;
  level?: 'info' | 'warn' | 'error';
}

export interface TtsMessage {
  kind: 'tts';
  id: string;
  text: string;
  voiceId?: string;
}

export interface ChatChunkMessage {
  kind: 'chat_chunk';
  id: string;
  text: string;
  done?: boolean;
}

export interface ExecRequestMessage {
  kind: 'exec';
  id: string;
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
  _consentWaiver?: { sense: string; until: string };
}

export interface ExecCancelMessage {
  kind: 'exec_cancel';
  id: string;
}

export interface ComputerRequestMessage {
  kind: 'computer';
  id: string;
  request: Record<string, unknown>;
  _consentWaiver?: { sense: string; until: string };
}

export interface SettingsRequestMessage {
  kind: 'settings';
  id: string;
  op: 'get' | 'set';
  patch?: Record<string, unknown>;
  machineProof?: MachineProof;
}

export interface EnvSettingsMessage {
  kind: 'env_settings';
  settings: Record<string, unknown>;
  authority?: PushAuthority;
  rejectedLoosenings?: Array<{ key: string; reason?: string }>;
}

export interface EnvUpdateMessage {
  kind: 'env_update';
  environmentId: string;
  name?: string;
  machineId?: string;
  connectors?: Array<{
    installId: string;
    kind: string;
    capabilities: string[];
    live: boolean;
    ts?: number;
  }>;
  settings?: Record<string, unknown>;
}

export interface SftpRequestMessage {
  kind: 'sftp_read' | 'sftp_write' | 'sftp_stat' | 'sftp_readdir';
  id: string;
  [key: string]: unknown;
}

export interface TerminalRpcMessage {
  kind: 'terminal_rpc';
  id: string;
  request: {
    method: string;
    path: string;
    body?: unknown;
    stream?: boolean;
  };
}

export interface TerminalRpcCancelMessage {
  kind: 'terminal_rpc_cancel';
  id: string;
}

export type ServerMessage =
  | RegisteredMessage
  | ErrorMessage
  | PongMessage
  | AlertMessage
  | TtsMessage
  | ChatChunkMessage
  | ExecRequestMessage
  | ExecCancelMessage
  | ComputerRequestMessage
  | SettingsRequestMessage
  | EnvSettingsMessage
  | EnvUpdateMessage
  | SftpRequestMessage
  | TerminalRpcMessage
  | TerminalRpcCancelMessage;
