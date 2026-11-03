---
title: "Universal AI Host Compatibility"
version: 3.8.53
lastUpdated: 2026-11-03
---

# Universal AI Host Compatibility

OmniRoute is a model gateway and MCP tool server. Different AI hosts consume it through different protocols. This guide separates **model inference routing** from **MCP tool access**; connecting an MCP server does not replace the host's own model backend.

## Protocol surfaces

| Surface | Endpoint | Intended clients |
|---|---|---|
| OpenAI Chat Completions | /v1/chat/completions | OpenAI SDKs, OpenAI-compatible apps, Cursor Chat, Continue, Cline and similar clients |
| OpenAI Responses | /v1/responses | Responses API clients and compatible agent runtimes |
| Anthropic Messages | /v1/messages | Claude Code and Anthropic-compatible clients |
| Models catalog | /v1/models | Client model discovery |
| MCP Streamable HTTP | /api/mcp/stream | Claude.ai custom connectors, Claude Code, Claude Desktop remote MCP, Cursor and other MCP clients |
| MCP stdio | omniroute --mcp | Local MCP-capable desktop/IDE clients |

Use the exact protocol expected by each client. Do not append /v1 to ANTHROPIC_BASE_URL; Claude Code appends /v1/messages itself. OpenAI-compatible clients generally use the /v1 base.

## Claude Code: model inference + MCP tools

### Route model inference through OmniRoute

Use the existing profile generator:

~~~bash
omniroute setup-claude
omniroute launch --profile <profile-name>
~~~

For a remote server:

~~~bash
omniroute setup-claude --remote https://YOUR-OMNIROUTE-HOST --api-key "$OMNIROUTE_API_KEY"
~~~

Claude Code uses the Anthropic Messages protocol. The generated profile sets ANTHROPIC_BASE_URL, ANTHROPIC_MODEL and gateway model discovery. The secret is injected at launch and is not written into profile JSON.

### Add OmniRoute MCP tools

Create a dedicated API key with the mcp:connect scope in the OmniRoute API Keys dashboard, then:

~~~bash
claude mcp add --transport http omniroute https://YOUR-OMNIROUTE-HOST/api/mcp/stream --header "Authorization: Bearer $OMNIROUTE_MCP_KEY"
~~~

The key must have mcp:connect (or broader manage) scope. Do not use an inference-only key. Check /mcp inside Claude Code to confirm the server is connected.

## Claude.ai, Claude Desktop remote connectors and Cowork

OmniRoute already exposes MCP Streamable HTTP at:

~~~text
https://YOUR-OMNIROUTE-HOST/api/mcp/stream
~~~

The server must be publicly reachable over HTTPS. Claude's hosted surfaces connect from Anthropic's cloud, not from your local device. A localhost URL or private-only address will not work.

1. Start OmniRoute and enable MCP.
2. Set MCP transport to streamable-http.
3. Create a dedicated API key with only mcp:connect.
4. In Claude.ai, open **Customize → Connectors → Add custom connector** and enter the remote MCP URL above.
5. If your Claude connector setup exposes fixed request-header authentication (documented by Anthropic as beta), configure Authorization: Bearer <your mcp:connect key>.
6. Enable the connector for the conversation and review every tool permission before approving actions.

Run omniroute setup-claude-ai --remote https://YOUR-OMNIROUTE-HOST --api-key "$OMNIROUTE_MCP_KEY" to print the connector URL and check that the MCP endpoint is enabled.

**Authentication compatibility note:** OmniRoute's remote MCP route currently authenticates API keys/access tokens with mcp:connect or manage; it does not yet implement the OAuth authorization-server endpoints (protected-resource metadata, authorization, token, refresh, and dynamic client registration) required for the standard OAuth connector path. Fixed request-header authentication is a beta option and may not be exposed for an individual custom connector. If your Claude account does not offer that option, do not disable MCP authentication or put a token in the URL; standard OAuth DCR/CIMD support is a separate implementation milestone.

**Model boundary:** This connector exposes OmniRoute tools to Claude. It does not redirect Claude.ai's own hosted model inference to OmniRoute and does not bypass Claude account usage limits. To route model inference, use Claude Code or another API-compatible client.

Anthropic references:
- [Custom connectors with remote MCP](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)
- [Building custom connectors](https://claude.com/docs/connectors/building)
- [Connector authentication](https://claude.com/docs/connectors/building/authentication)

## Claude Desktop local MCP

For a local installation, use the stdio server:

~~~json
{
  "mcpServers": {
    "omniroute": {
      "command": "omniroute",
      "args": ["--mcp"]
    }
  }
}
~~~

The local process inherits the environment and data directory from the user account. Keep provider credentials in OmniRoute's encrypted credential store; do not place provider keys in the desktop MCP JSON.

## Other supported AI coding hosts

OmniRoute already has dedicated setup commands. Use the live model catalog so the client only receives models available from your configured providers.

| Client | Setup command | Notes |
|---|---|---|
| Codex CLI | omniroute setup-codex | Generates model profiles; Codex CLI uses its configured Responses API provider |
| Cursor | omniroute setup-cursor | Custom OpenAI base URL supports Cursor Chat; Composer/inline/autocomplete may remain on Cursor's own backend |
| Gemini CLI | omniroute setup-gemini | Uses the supported Gemini CLI configuration path |
| OpenCode | omniroute setup-opencode | OpenCode provider configuration |
| Cline | omniroute setup-cline | OpenAI-compatible provider configuration |
| Continue | omniroute setup-continue | Configure the model endpoint in Continue |
| Roo Code | omniroute setup-roo | Configure provider/base URL and model |
| Kilo Code | omniroute setup-kilo | Configure provider/base URL and model |
| Aider | omniroute setup-aider | OpenAI-compatible endpoint |
| Goose | omniroute setup-goose | OpenAI-compatible endpoint |
| Zed | omniroute setup-zed | Configure the supported Zed assistant provider |
| Qwen Code | omniroute setup-qwen | Configure Qwen CLI |
| Crush | omniroute setup-crush | Configure Crush |

For clients without a dedicated setup command, use their documented custom OpenAI-compatible base URL with https://YOUR-OMNIROUTE-HOST/v1, an OmniRoute inference API key, and a model ID returned by GET /v1/models. For native Anthropic-compatible clients, use the root URL (without /v1) and the Anthropic Messages protocol. For MCP-capable clients, use Streamable HTTP or local stdio.

## Security and operational requirements

- Use HTTPS for remote traffic; terminate TLS at a trusted reverse proxy or deployment platform.
- Use separate credentials for inference and MCP administration.
- Grant mcp:connect instead of manage when only MCP tool access is needed.
- Never pass credentials in URL query parameters, commit them, or include them in generated config files.
- Do not expose MCP without authentication. MCP tools can perform writes and other actions.
- Review tool scopes and approval prompts. Disable tools not needed by the connected host.
- Claude.ai custom connectors are cloud-to-server connections; allow public HTTPS reachability and account for Anthropic's current outbound IP ranges if using a restrictive firewall.
- A provider fallback only works when the fallback provider is configured, authorized, healthy, and supports the request's capabilities. It does not create free quota or bypass upstream provider limits.
