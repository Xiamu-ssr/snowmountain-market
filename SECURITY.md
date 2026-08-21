# Security policy

## Trust boundary

`WIND_API_KEY` belongs to the DSH host credential plane. It must not appear in
model context, workspace files, Skills, tool arguments, plugin settings values,
or model-visible shell processes.

The loopback proxy in this plugin is a credential adapter, not a general proxy:
it binds to `127.0.0.1`, uses a random per-process path, and maps only to the
fixed Wind MCP endpoints declared in source. It resolves the credential for
each upstream request.

Wind requests necessarily disclose their business query and selected context
to Wind. Do not send confidential material unless the deployment's policy and
Wind's service terms permit it.

## Reporting a vulnerability

Open a private GitHub security advisory for this repository. Do not include a
real API key, captured Authorization header, or confidential financial data in
an issue, log, screenshot, or proof of concept.

