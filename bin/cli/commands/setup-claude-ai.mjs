#!/usr/bin/env node

import { printHeading, printInfo, printSuccess, printWarning, printError } from "../io.mjs";
import { isLoopbackUrl } from "../api.mjs";

export function normalizeOmniRouteRoot(value) {
  return String(value || "").trim().replace(/\/+$/, "").replace(/\/v1$/i, "");
}

export function buildClaudeAiConnectorInfo(baseUrl) {
  const root = normalizeOmniRouteRoot(baseUrl);
  return {
    name: "OmniRoute",
    transport: "Streamable HTTP",
    serverUrl: root + "/api/mcp/stream",
    requiredHeader: "Authorization: Bearer <OmniRoute API key with mcp:connect scope>",
    authMode: "static_headers (Claude connector beta) or OAuth when an OAuth authorization server is configured",
    inferenceNote: "This connects Claude to OmniRoute MCP tools. It does not change the model used by claude.ai or route Claude's hosted inference through OmniRoute.",
  };
}

export function buildClaudeAiConnectorInstructions(info) {
  return [
    "Claude.ai → Customize → Connectors → Add custom connector",
    "Name: " + info.name,
    "Remote MCP URL: " + info.serverUrl,
    "Transport: " + info.transport,
    "",
    "Authentication:",
    "  " + info.requiredHeader,
    "  Use a dedicated API key whose only management permission is mcp:connect.",
    "  Never put the key in the URL or query string.",
    "",
    "Important:",
    "  Claude's fixed request-header authentication is currently documented as beta.",
    "  If your connector UI does not offer static request headers, OmniRoute's API-key",
    "  endpoint cannot complete Claude.ai's OAuth flow yet. Do not disable authentication",
    "  or expose an unauthenticated MCP endpoint as a workaround.",
    "",
    info.inferenceNote,
  ].join("\n");
}

export async function runSetupClaudeAiCommand(opts = {}) {
  const root = normalizeOmniRouteRoot(
    opts.remote ?? process.env.OMNIROUTE_BASE_URL ?? ("http://localhost:" + (Number(opts.port ?? process.env.PORT ?? 20128) || 20128))
  );
  const info = buildClaudeAiConnectorInfo(root);

  printHeading("OmniRoute → Claude.ai remote MCP connector");
  printInfo("Remote MCP endpoint: " + info.serverUrl);

  if (isLoopbackUrl(root) || !root.startsWith("https://")) {
    printWarning("Claude.ai connects from Anthropic's cloud. Use a publicly reachable HTTPS OmniRoute URL; localhost/private-only URLs will not work.");
  }

  const apiKey = opts.apiKey ?? opts["api-key"] ?? process.env.OMNIROUTE_API_KEY ?? "";
  if (apiKey) {
    try {
      const response = await fetch(root + "/api/mcp/status", {
        headers: { Authorization: "Bearer " + apiKey },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) {
        printError("MCP status check failed: HTTP " + response.status);
        return 1;
      }
      const status = await response.json();
      if (!status.enabled || status.transport !== "streamable-http") {
        printWarning("MCP is " + (status.enabled ? "enabled" : "disabled") + " with transport " + JSON.stringify(status.transport) + ". Enable MCP and select streamable-http before connecting.");
        return 1;
      }
      printSuccess("MCP endpoint is enabled and configured for Streamable HTTP.");
    } catch (error) {
      printWarning("Could not verify the remote endpoint (" + (error instanceof Error ? error.message : "network error") + ").");
    }
  } else {
    printInfo("Live check skipped. Set OMNIROUTE_API_KEY to a dedicated key with mcp:connect scope to verify.");
  }

  console.log("");
  console.log(buildClaudeAiConnectorInstructions(info));
  console.log("");
  printInfo("For Claude Code, use omniroute setup-claude and claude mcp add separately.");
  return 0;
}

export function registerSetupClaudeAi(program) {
  program
    .command("setup-claude-ai")
    .description("Print and validate the Claude.ai remote MCP connector setup")
    .option("--remote <url>", "Public HTTPS OmniRoute root URL")
    .option("--port <port>", "Local OmniRoute port when --remote is omitted", "20128")
    .option("--api-key <key>", "MCP status-check key (prefer OMNIROUTE_API_KEY env var)")
    .action(async (opts) => {
      const exitCode = await runSetupClaudeAiCommand(opts);
      if (exitCode !== 0) process.exit(exitCode);
    });
}
