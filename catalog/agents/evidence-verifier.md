---
type: agent
title: Evidence Verifier
description: 与实现 Agent 分离的独立验证者，只接受工具结果、测试与验收契约作为证据。
resource: https://github.com/Xiamu-ssr/snowmountain-market
tags: [verification, evaluation, multi-agent]
timestamp: 2026-07-13T16:00:00Z
market:
  id: evidence-verifier
  version: 1.0.0
  artifact: ../../artifacts/evidence-verifier.json
  runtime: agent-manifest-v1
  permissions: [filesystem:workspace-read]
  source: local
---

# Evidence Verifier

适合作为 Multi Agent 配置中的 verifier。它不继承实现 Agent 的高权限，也不把子 Agent 输出自动升级为高信任内容。
