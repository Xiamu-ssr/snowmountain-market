# 雪山 Market

一个 Git-first、OKF-compatible 的可移植能力目录，只收纳四种一级资产：`MCP`、`Skill`、`Plugin`、`CLI`。`Tool` 是运行时暴露的调用单元，不是这里的发行包类型；`Agent Manifest` 属于方舟的 Agent 配置，也不进入这个解耦数据子项目。

Market 不执行安装、不托管用户凭证。构建产物只有静态网站、`api/catalog.json`、每条能力的详情 JSON，以及带 SHA-256 的制品文件。雪山方舟在 Agent 创建页读取这个 endpoint；其他 Agent 也可以独立消费。

## Git-first 是什么意思

Git-first 只说明**事实源和变更流程**，不等于“不需要程序或部署”：

- 能力条目、版本、权限、来源和制品引用的权威数据保存在 Git 仓库；修改通过 commit / review / tag 审计。
- 构建程序读取这些 Markdown 与 Manifest，校验 Schema 和 SHA-256，再生成前端和静态 JSON API。
- 运行时仍需要浏览器前端和 HTTP 托管；当前由 Vite 构建、GitHub Pages 部署，也可以用仓库内 Dockerfile 自托管。
- 部署后的数据来自构建时的 Git snapshot，不依赖在线数据库；仓库更新并重新部署后才会改变。
- 外部 Registry 不在网站运行时被直接查询。`pnpm sync:external` 是一个显式动作，产物 `imports/external.json` 必须进入 Git review。
- “Git-first”只适用于雪山 Market，不适用于数据库驱动的雪山方舟中台。

## 分类模型

- 一级类型：`MCP / Skill / Plugin / CLI`，固定且互斥。
- 二级分类：只在一级类型内部生效，例如 Skill 的“金融研究”和 MCP 的“金融数据”。
- 标签/徽章：跨分类表达“官方”“精选”等属性，不改变类型与分类。
- 来源渠道：仅用于溯源、同步状态和数量展示，不参与分类。

## 外部来源（溯源信息）

| 来源 | 当前快照 | 接入边界 |
|---|---:|---|
| ClawHub | 400 Skills | 使用公开目录 API，只抓取 `nonSuspiciousOnly` 元数据；仍标记为未经过雪山安全审查 |
| Official MCP Registry | 302 MCP Servers | 只收录 `active + latest`；命名空间验证不等于服务端代码安全 |
| Wind AIFin Market | 90 Skills、7 MCP；另有 1 条上游 Agent 元数据不纳入 Catalog | 使用公开市场元数据和官方 `skill.md`；重点能力标记“官方 / 精选”，Key 与安装仍由 Wind 管理 |
| skills.sh | 来源已登记 | API 要求 Vercel OIDC，未绕过认证抓取 |
| Anthropic Agent Skills | 来源已登记 | 子目录许可证不同；由上游目录覆盖，未重复复制内容 |

同步：

```bash
pnpm sync:external
pnpm test
pnpm build
```

同步器只缓存目录元数据和上游链接，不下载或重新发布第三方代码。每条远端记录都包含类型、类内分类、标签、溯源、验证、许可证、访问条件和风险；前端按类型、分类与标签浏览，来源只读。

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

1. 在 `catalog/{skills,mcps,plugins,cli}` 新增带 OKF frontmatter 的 Markdown concept。
2. 在 `artifacts/` 添加可审计 Manifest 或压缩制品。
3. 在 `market.artifact` 中使用相对 concept 文件的路径。
4. 运行 `pnpm test && pnpm build`。构建器会校验 Schema、阻止路径逃逸、计算 SHA-256 并生成静态 API。

外部来源不要手工伪装成本地条目；更新 `imports/external.json` 应运行同步器并审查 diff。Registry 收录、下载量和发布方身份都不是雪山安全背书。

## 部署

仓库内的 GitHub Pages workflow 在 `main` 更新时构建并发布。部署时通过：

- `BASE_PATH=/snowmountain-market/`
- `PUBLIC_BASE_URL=https://xiamu-ssr.github.io/snowmountain-market`

生成可从其他 Agent 平台访问的绝对 endpoint。
