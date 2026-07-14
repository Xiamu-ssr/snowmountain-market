# 雪山 Market

一个 Git-first、OKF-compatible 的 Agent 能力目录，收纳 Skill、MCP、Tool 和 Agent Manifest。

Market 不执行安装、不托管用户凭证。构建产物只有静态网站、`api/catalog.json`、每条能力的详情 JSON，以及带 SHA-256 的制品文件。雪山方舟在 Agent 创建页读取这个 endpoint；其他 Agent 也可以独立消费。

## Git-first 是什么意思

Git-first 只说明**事实源和变更流程**，不等于“不需要程序或部署”：

- 能力条目、版本、权限、来源和制品引用的权威数据保存在 Git 仓库；修改通过 commit / review / tag 审计。
- 构建程序读取这些 Markdown 与 Manifest，校验 Schema 和 SHA-256，再生成前端和静态 JSON API。
- 运行时仍需要浏览器前端和 HTTP 托管；当前由 Vite 构建、GitHub Pages 部署，也可以用仓库内 Dockerfile 自托管。
- 部署后的数据来自构建时的 Git snapshot，不依赖在线数据库；仓库更新并重新部署后才会改变。
- “Git-first”只适用于雪山 Market，不适用于数据库驱动的雪山方舟中台。

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

## 部署

仓库内的 GitHub Pages workflow 在 `main` 更新时构建并发布。部署时通过：

- `BASE_PATH=/snowmountain-market/`
- `PUBLIC_BASE_URL=https://xiamu-ssr.github.io/snowmountain-market`

生成可从其他 Agent 平台访问的绝对 endpoint。
