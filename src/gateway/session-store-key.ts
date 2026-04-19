import { listAgentIds, resolveDefaultAgentId } from "../agents/agent-scope.js";
import {
  canonicalizeMainSessionAlias,
  resolveMainSessionKey,
} from "../config/sessions/main-session.js";
import type { OpenClawConfig } from "../config/types.openclaw.js";
import {
  DEFAULT_AGENT_ID,
  normalizeAgentId,
  normalizeMainKey,
  parseAgentSessionKey,
  type ParsedAgentSessionKey,
} from "../routing/session-key.js";
import {
  normalizeLowercaseStringOrEmpty,
  normalizeOptionalString,
} from "../shared/string-coerce.js";

export function canonicalizeSessionKeyForAgent(agentId: string, key: string): string {
  const lowered = normalizeLowercaseStringOrEmpty(key);
  if (lowered === "global" || lowered === "unknown") {
    return lowered;
  }
  if (lowered.startsWith("agent:")) {
    return lowered;
  }
  return `agent:${normalizeAgentId(agentId)}:${lowered}`;
}

function resolveDefaultStoreAgentId(cfg: OpenClawConfig): string {
  return normalizeAgentId(resolveDefaultAgentId(cfg));
}

function resolveParsedSessionStoreAgentId(
  cfg: OpenClawConfig,
  parsed: ParsedAgentSessionKey,
): string {
  const agentId = normalizeAgentId(parsed.agentId);
  if (agentId !== DEFAULT_AGENT_ID || listAgentIds(cfg).includes(DEFAULT_AGENT_ID)) {
    return agentId;
  }
  const rest = normalizeLowercaseStringOrEmpty(parsed.rest);
  const mainKey = normalizeMainKey(cfg.session?.mainKey);
  if (rest === "main" || rest === mainKey) {
    return resolveDefaultStoreAgentId(cfg);
  }
  return agentId;
}

export function resolveSessionStoreKey(params: {
  cfg: OpenClawConfig;
  sessionKey: string;
}): string {
  const raw = normalizeOptionalString(params.sessionKey) ?? "";
  if (!raw) {
    return raw;
  }
  const rawLower = normalizeLowercaseStringOrEmpty(raw);
  if (rawLower === "global" || rawLower === "unknown") {
    return rawLower;
  }

  const parsed = parseAgentSessionKey(raw);
  if (parsed) {
    const originalAgentId = normalizeAgentId(parsed.agentId);
    const agentId = resolveParsedSessionStoreAgentId(params.cfg, parsed);
    const lowered =
      agentId === originalAgentId
        ? normalizeLowercaseStringOrEmpty(raw)
        : `agent:${agentId}:${normalizeLowercaseStringOrEmpty(parsed.rest)}`;
    const canonical = canonicalizeMainSessionAlias({
      cfg: params.cfg,
      agentId,
      sessionKey: lowered,
    });
    if (canonical !== lowered) {
      return canonical;
    }
    return lowered;
  }

  const lowered = normalizeLowercaseStringOrEmpty(raw);
  const rawMainKey = normalizeMainKey(params.cfg.session?.mainKey);
  if (lowered === "main" || lowered === rawMainKey) {
    return resolveMainSessionKey(params.cfg);
  }
  const agentId = resolveDefaultStoreAgentId(params.cfg);
  return canonicalizeSessionKeyForAgent(agentId, lowered);
}

export function resolveSessionStoreAgentId(cfg: OpenClawConfig, canonicalKey: string): string {
  if (canonicalKey === "global" || canonicalKey === "unknown") {
    return resolveDefaultStoreAgentId(cfg);
  }
  const parsed = parseAgentSessionKey(canonicalKey);
  if (parsed?.agentId) {
    return normalizeAgentId(parsed.agentId);
  }
  return resolveDefaultStoreAgentId(cfg);
}

export function canonicalizeSpawnedByForAgent(
  cfg: OpenClawConfig,
  agentId: string,
  spawnedBy?: string,
): string | undefined {
  const raw = normalizeOptionalString(spawnedBy) ?? "";
  if (!raw) {
    return undefined;
  }
  const lower = normalizeLowercaseStringOrEmpty(raw);
  if (lower === "global" || lower === "unknown") {
    return lower;
  }
  let result: string;
  if (lower.startsWith("agent:")) {
    result = lower;
  } else {
    result = `agent:${normalizeAgentId(agentId)}:${lower}`;
  }
  // Resolve main-alias references (e.g. agent:ops:main -> configured main key).
  const parsed = parseAgentSessionKey(result);
  const resolvedAgent = parsed?.agentId ? normalizeAgentId(parsed.agentId) : agentId;
  return canonicalizeMainSessionAlias({ cfg, agentId: resolvedAgent, sessionKey: result });
}
