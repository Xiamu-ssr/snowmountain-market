# 雪山 Market

一个 Git-first、OKF-compatible 的 Agent 能力目录，收纳 Skill、MCP、Tool 和 Agent Manifest。当前 Git 快照包含 804 条能力：4 条雪山人工审查样例，以及来自 ClawHub、Official MCP Registry 和 Wind AIFin Market 的 800 条公开元数据。

Market 不执行安装、不托管用户凭证。构建产物只有静态网站、`api/catalog.json`、每条能力的详情 JSON，以及带 SHA-256 的制品文件。雪山方舟在 Agent 创建页读取这个 endpoint；其他 Agent 也可以独立消费。

## Git-first 是什么意思

Git-first 只说明**事实源和变更流程**，不等于“不需要程序或部署”：

- 能力条目、版本、权限、来源和制品引用的权威数据保存在 Git 仓库；修改通过 commit / review / tag 审计。
- 构建程序读取这些 Markdown 与 Manifest，校验 Schema 和 SHA-256，再生成前端和静态 JSON API。
- 运行时仍需要浏览器前端和 HTTP 托管；当前由 Vite 构建、GitHub Pages 部署，也可以用仓库内 Dockerfile 自托管。
- 部署后的数据来自构建时的 Git snapshot，不依赖在线数据库；仓库更新并重新部署后才会改变。
- 外部 Registry 不在网站运行时被直接查询。`pnpm sync:external` 是一个显式动作，产物 `imports/external.json` 必须进入 Git review。
- “Git-first”只适用于雪山 Market，不适用于数据库驱动的雪山方舟中台。

## 外部来源

| 来源 | 当前快照 | 接入边界 |
|---|---:|---|
| ClawHub | 400 Skills | 使用公开目录 API，只抓取 `nonSuspiciousOnly` 元数据；仍标记为未经过雪山安全审查 |
| Official MCP Registry | 302 MCP Servers | 只收录 `active + latest`；命名空间验证不等于服务端代码安全 |
| Wind AIFin Market | 90 Skills、7 MCP、1 Agent | 使用公开市场元数据和官方 `skill.md`；Key 与安装仍由 Wind 管理 |
| skills.sh | 来源已登记 | API 要求 Vercel OIDC，未绕过认证抓取 |
| Anthropic Agent Skills | 来源已登记 | 子目录许可证不同；由上游目录覆盖，未重复复制内容 |

同步：

```bash
pnpm sync:external
pnpm test
pnpm build
```

同步器只缓存目录元数据和上游链接，不下载或重新发布第三方 Skill/MCP 代码。每条远端记录都包含 `registry`、`provider`、`category`、`verification`、`license`、`access` 和 `risk`，前端可以按分类、来源与标签筛选。

## 本地运行

```bash
pnpm install
pnpm test
pnpm dev
```

默认地址：`http://127.0.0.1:4320`；Catalog endpoint：`http://127.0.0.1:4320/api/catalog.json`。

也可以构建静态容器：

```bash
docker build -t snowmountain-market .
docker run --rm -p 4320:80 snowmountain-market
```

## 添加条目

1. 在 `catalog/{skills,mcps,tools,agents}` 新增带 OKF frontmatter 的 Markdown concept。
2. 在 `artifacts/` 添加可审计 Manifest 或压缩制品。
3. 在 `market.artifact` 中使用相对 concept 文件的路径。
4. 运行 `pnpm test && pnpm build`。构建器会校验 Schema、阻止路径逃逸、计算 SHA-256 并生成静态 API。

外部来源不要手工伪装成本地条目；更新 `imports/external.json` 应运行同步器并审查 diff。Registry 收录、下载量和发布方身份都不是雪山安全背书。

## 部署

仓库内的 GitHub Pages workflow 在 `main` 更新时构建并发布。部署时通过：

- `BASE_PATH=/snowmountain-market/`
- `PUBLIC_BASE_URL=https://xiamu-ssr.github.io/snowmountain-market`

生成可从其他 Agent 平台访问的绝对 endpoint。
