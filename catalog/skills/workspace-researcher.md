---
type: skill
title: Workspace Researcher
description: 遍历项目 OKF 索引，按需阅读关联 concept，并以文件链接返回证据。
resource: https://github.com/Xiamu-ssr/snowmountain-market
tags: [okf, research, filesystem]
timestamp: 2026-07-13T16:00:00Z
market:
  id: workspace-researcher
  version: 1.0.0
  artifact: ../../artifacts/workspace-researcher.json
  runtime: skill-v1
  permissions: [filesystem:workspace-read]
  source: local
---

# Workspace Researcher

从项目 `index.md` 开始，按普通 Markdown 链接渐进读取，不把整个知识库一次塞进上下文。所有结论必须指向实际文件；找不到证据时明确标注推断。

本条目只提供可审计 Manifest 和安装说明，不代表 Market 可以写入你的 Agent 配置。
