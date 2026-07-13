---
type: mcp
title: Filesystem MCP · Read-only Workspace
description: 只向 Agent 暴露 /workspace 的文件读取能力，适合研究与独立验证任务。
resource: https://github.com/modelcontextprotocol/servers
tags: [mcp, filesystem, readonly]
timestamp: 2026-07-13T16:00:00Z
market:
  id: filesystem-readonly-mcp
  version: 1.0.0
  artifact: ../../artifacts/filesystem-mcp.json
  runtime: mcp-stdio-v1
  permissions: [filesystem:workspace-read]
  source: remote
---

# Filesystem MCP · Read-only Workspace

安装前固定上游版本并审查实际包内容。远程来源的安装时审核不会自动延续为运行时信任；工具返回内容仍可能携带 prompt injection。
