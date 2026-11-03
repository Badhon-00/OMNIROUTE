import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeOmniRouteRoot,
  buildClaudeAiConnectorInfo,
  buildClaudeAiConnectorInstructions,
} from "../../../bin/cli/commands/setup-claude-ai.mjs";

describe("setup-claude-ai", () => {
  it("normalizes root URLs without damaging paths", () => {
    assert.equal(normalizeOmniRouteRoot("https://router.example/v1/"), "https://router.example");
    assert.equal(normalizeOmniRouteRoot("https://router.example/gateway/"), "https://router.example/gateway");
  });

  it("builds a Streamable HTTP MCP endpoint", () => {
    const info = buildClaudeAiConnectorInfo("https://router.example/");
    assert.equal(info.serverUrl, "https://router.example/api/mcp/stream");
    assert.equal(info.transport, "Streamable HTTP");
  });

  it("documents least-privilege MCP authentication and the hosted-inference boundary", () => {
    const info = buildClaudeAiConnectorInfo("https://router.example");
    const instructions = buildClaudeAiConnectorInstructions(info);
    assert.match(instructions, /mcp:connect/);
    assert.match(instructions, /Never put the key in the URL/);
    assert.match(instructions, /does not change the model used by claude\.ai/);
    assert.match(instructions, /do not disable/);
  });

  it("never includes an actual API key in generated connector information", () => {
    const info = buildClaudeAiConnectorInfo("https://router.example");
    assert.equal(JSON.stringify(info).includes("sk-secret"), false);
    assert.equal(info.requiredHeader.includes("<OmniRoute API key"), true);
  });
});
