# dsh-wind-aifin

Credential-safe [Wind AIFin](https://aifinmarket.wind.com.cn/) integration for
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH).

[简体中文](./README.zh-CN.md)

## What it provides

- Seven official Wind Streamable HTTP MCP domains are connected through DSH's
  own `@deepseek-ai/dsh-mcp-client` and exposed as native tools:
  `wind_stock`, `wind_fund`, `wind_index`, `wind_bond`, `wind_docs`,
  `wind_economic`, and `wind_analytics`.
- `wind_alice` invokes Wind Alice's professional financial-analysis workflows,
  including fact checking, company one-pagers, earnings reviews, screening,
  macro, bond, credit, fund, market-sizing, and comparable-company analysis.
- Two runtime Skills teach the agent how to route requests without putting an
  API key or shell commands into the prompt.
- A Settings namespace declares `WIND_API_KEY` as a DSH credential reference.

## Why a plugin is needed

DSH intentionally removes credential-shaped environment variables from
model-visible shell processes. Putting `WIND_API_KEY` in the host environment
therefore does not make the official Wind CLI available to an Agent's Bash
tool—and copying the key into the workspace would defeat the boundary.

This plugin resolves the credential inside the trusted host process. Wind MCP
traffic passes through a random, loopback-only adapter that injects the Bearer
token and then delegates protocol handling and tool registration to DSH's MCP
client. Alice resolves the same credential per operation. The key is never
returned to the model, stored in plugin configuration, or exposed to ordinary
Bash commands.

## Install

DSH `0.1.0-rc.8` or newer is recommended.

```bash
dsh plugin --profile web add github:Xiamu-ssr/snowmountain-market
```

Restart the profile after installation. Install into another profile by
replacing `web` with that profile's name.

## Configure

Create a Wind AIFin API key at the
[Wind developer portal](https://aifinmarket.wind.com.cn/#/user/overview), then
store it as the DSH credential reference `WIND_API_KEY` using the Credentials
page. A deployment may instead provide `WIND_API_KEY` in the trusted DSH launch
environment.

Do not put the key in a workspace file, Skill file, prompt, MCP headers in
`cordis.patch.yml`, or a model-visible shell profile.

## Tool names

MCP tools follow DSH's standard qualified naming convention:

| Domain | Prefix |
| --- | --- |
| Stocks | `mcp__wind_stock__` |
| Funds and ETFs | `mcp__wind_fund__` |
| Indices and sectors | `mcp__wind_index__` |
| Bonds | `mcp__wind_bond__` |
| Filings and financial news | `mcp__wind_docs__` |
| Macro and industry indicators | `mcp__wind_economic__` |
| Cross-asset analytics | `mcp__wind_analytics__` |

Wind Alice is exposed as `wind_alice` and accepts a prompt plus an optional
professional workflow name.

## Security and data flow

- The credential adapter listens only on `127.0.0.1` and uses an unguessable
  per-process route.
- The adapter accepts only the seven fixed Wind endpoints; users cannot turn it
  into a general authenticated proxy.
- Credentials are resolved for each request and are not cached in files.
- Financial requests and selected context are sent to Wind's service. Review
  Wind's service terms before sending confidential information.
- This plugin has no install script and does not bundle or redistribute Wind's
  official Skills repository.

In version `0.1.0`, Alice's final textual/data artifact is returned to the
Agent; Alice-generated downloadable files are not automatically copied into the
DSH workspace.

## Development

```bash
npm install
npm test
npm pack --dry-run
```

See [SECURITY.md](./SECURITY.md) for vulnerability reporting and the trust
boundary. This is a community adapter and is not an official Wind product.

