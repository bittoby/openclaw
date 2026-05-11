import { describe, expect, it } from "vitest";
import {
  WHATSAPP_RELOAD_DECLARATION,
  whatsappChannelConfigRoot,
  whatsappGroupConfigPath,
} from "./shared.js";

type ReloadDeclaration = typeof WHATSAPP_RELOAD_DECLARATION;

function hasPrefix(declaration: ReloadDeclaration, prefix: string): boolean {
  return (declaration.configPrefixes ?? []).includes(prefix);
}

function isPathCoveredByPrefix(prefix: string, path: string): boolean {
  return path === prefix || path.startsWith(`${prefix}.`);
}

function isPathCoveredByDeclaration(declaration: ReloadDeclaration, path: string): boolean {
  return (declaration.configPrefixes ?? []).some((prefix) => isPathCoveredByPrefix(prefix, path));
}

const WHATSAPP_CONFIG_ROOT = whatsappChannelConfigRoot();
const SAMPLE_GROUP_ID = "120363001234567890@g.us";

const CHANGED_PATHS_THAT_MUST_RELOAD = [
  // Regression: #80704 — hot-reload of `channels.whatsapp.groups` was silently
  // dropped because the plugin declared the whole subtree as a noop prefix.
  whatsappGroupConfigPath(SAMPLE_GROUP_ID),
  `${whatsappGroupConfigPath(SAMPLE_GROUP_ID)}.requireMention`,
  `${WHATSAPP_CONFIG_ROOT}.groupPolicy`,
  `${WHATSAPP_CONFIG_ROOT}.groupAllowFrom`,
  `${WHATSAPP_CONFIG_ROOT}.allowFrom`,
  `${WHATSAPP_CONFIG_ROOT}.dmPolicy`,
  `${WHATSAPP_CONFIG_ROOT}.accounts.default.allowFrom`,
  `${WHATSAPP_CONFIG_ROOT}.accounts.default.groups.${SAMPLE_GROUP_ID}`,
] as const;

describe("WHATSAPP_RELOAD_DECLARATION", () => {
  it("declares the canonical channel config root as a hot-reload prefix", () => {
    expect(hasPrefix(WHATSAPP_RELOAD_DECLARATION, WHATSAPP_CONFIG_ROOT)).toBe(true);
  });

  it("does not silently noop every `channels.whatsapp.*` change (regression for #80704)", () => {
    // The historical declaration was:
    //   { configPrefixes: ["web"], noopPrefixes: ["channels.whatsapp"] }
    // which left `channels.whatsapp.groups.@g.us` patches as silent noops in
    // the gateway reload plan. Guard against any future re-introduction of a
    // broad `channels.whatsapp` noop prefix that would re-create the bug.
    const declaration = WHATSAPP_RELOAD_DECLARATION as ReloadDeclaration & {
      noopPrefixes?: readonly string[];
    };
    const noopPrefixes = declaration.noopPrefixes ?? [];
    expect(noopPrefixes).not.toContain(WHATSAPP_CONFIG_ROOT);
    for (const noopPrefix of noopPrefixes) {
      expect(isPathCoveredByPrefix(noopPrefix, `${WHATSAPP_CONFIG_ROOT}.groups`)).toBe(false);
      expect(isPathCoveredByPrefix(noopPrefix, `${WHATSAPP_CONFIG_ROOT}.groupPolicy`)).toBe(false);
      expect(isPathCoveredByPrefix(noopPrefix, `${WHATSAPP_CONFIG_ROOT}.allowFrom`)).toBe(false);
    }
  });

  it("covers every config path that must trigger a WhatsApp listener restart", () => {
    for (const path of CHANGED_PATHS_THAT_MUST_RELOAD) {
      expect(isPathCoveredByDeclaration(WHATSAPP_RELOAD_DECLARATION, path)).toBe(true);
    }
  });

  it("does not rely on the legacy unscoped `web` prefix", () => {
    // The previous declaration used `configPrefixes: ["web"]`, but no live
    // OpenClaw config path begins with a bare `web` segment, so that prefix
    // matched nothing. Make sure we never regress to that shape.
    expect(hasPrefix(WHATSAPP_RELOAD_DECLARATION, "web")).toBe(false);
  });
});
