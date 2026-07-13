---
type: tool
title: Sandbox Persistence Probe
description: 在 /workspace 创建并回读一个探针文件，用事件证据验证 Session 工作区持久性。
resource: https://github.com/Xiamu-ssr/snowmountain-market
tags: [sandbox, session, probe]
timestamp: 2026-07-13T16:00:00Z
market:
  id: sandbox-probe
  version: 1.0.0
  artifact: ../../artifacts/sandbox-probe.json
  runtime: tool-schema-v1
  permissions: [filesystem:workspace-write]
  source: local
---

# Sandbox Persistence Probe

该工具只声明输入、权限和副作用。实际执行器由 Managed Agent 平台提供；Market 不远程执行代码。
