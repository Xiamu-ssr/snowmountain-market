# dsh-wind-aifin

面向 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的万得
Wind AIFin 凭证安全适配器。

## 能力

- 使用 DSH 自带的 `@deepseek-ai/dsh-mcp-client` 接入 Wind 七个官方 MCP 域：
  股票、基金、指数、债券、公告资讯、宏观经济和跨标的分析。
- 提供原生 `wind_alice` 工具，支持事实核验、公司一页纸、财报点评、主题选股、
  宏观、债券、信用、基金、市场规模和可比公司分析等专业工作流。
- 注册两个运行时 Skill，让 Agent 知道如何路由工具。
- 在 Settings/Credentials 中声明 `WIND_API_KEY` 凭证引用。

## 为什么需要插件

DSH 会从模型可见的 Bash 中剥离 `KEY`、`TOKEN`、`SECRET` 等凭证变量。因此，即使
宿主已经配置 `WIND_API_KEY`，Agent 直接运行 Wind CLI 仍会显示“未配置”；若把 Key
写入工作区，又会破坏凭证边界。

本插件在可信宿主进程内按请求解析 Key。七路 MCP 请求先经过一个仅监听
`127.0.0.1`、路径随机且上游固定的适配器注入 Bearer Token，再交给 DSH 官方 MCP
Client 完成协议、工具发现和调用。Alice 同样只在宿主执行边界拿到 Key。模型、普通
Bash、Skill 文本和工作区文件都拿不到明文。

## 安装

推荐 DSH `0.1.0-rc.8` 或更新版本：

```bash
dsh plugin --profile web add github:Xiamu-ssr/snowmountain-market
```

安装后重启对应 Profile。若要给 Headless/TUI 使用，把 `web` 换成对应 Profile 名。

## 配置

在 [Wind 开发者中心](https://aifinmarket.wind.com.cn/#/user/overview) 获取 Key，
然后在 DSH Credentials 页面存为 `WIND_API_KEY`。服务端部署也可以通过 DSH 的可信
启动环境提供该变量。

不要把 Key 写入工作区、Skill、Prompt、`cordis.patch.yml` 的 MCP Headers 或
模型可见的 Shell 配置。

## 工具前缀

| 能力域 | 工具前缀 |
| --- | --- |
| 股票 | `mcp__wind_stock__` |
| 基金/ETF | `mcp__wind_fund__` |
| 指数/板块 | `mcp__wind_index__` |
| 债券 | `mcp__wind_bond__` |
| 公告/财经新闻 | `mcp__wind_docs__` |
| 宏观/行业经济 | `mcp__wind_economic__` |
| 跨标的分析 | `mcp__wind_analytics__` |

Alice 工具名为 `wind_alice`，输入金融分析任务和可选的专业工作流。

`0.1.0` 会把 Alice 最终文本/数据结果返回 Agent；Alice 生成的可下载文件暂不自动
复制进 DSH 工作区。

本项目是社区适配器，不是 Wind 官方产品。

