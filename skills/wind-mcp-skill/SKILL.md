---
name: wind-mcp-skill
description: 通过 DSH 原生 MCP 工具访问万得金融数据，覆盖股票、基金、指数、债券、公告资讯、宏观经济和跨标的分析。密钥由宿主凭证服务持有。
---

# Wind 金融数据（DSH 原生 MCP）

插件运行时会注册本 Skill；这里保留同一份人类可读说明。只使用
`mcp__wind_stock__*`、`mcp__wind_fund__*`、`mcp__wind_index__*`、
`mcp__wind_bond__*`、`mcp__wind_docs__*`、`mcp__wind_economic__*` 和
`mcp__wind_analytics__*` 工具。不要从 Bash 调用 Wind CLI，也不要接触
`WIND_API_KEY`。

