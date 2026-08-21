export const RUNTIME_SKILLS = Object.freeze([
  Object.freeze({
    name: 'wind-mcp-skill',
    description: '通过 DSH 原生 MCP 工具访问万得金融数据，覆盖股票、基金、指数、债券、公告资讯、宏观经济和跨标的分析。密钥由宿主凭证服务持有。',
    source: 'runtime',
    content: `# Wind 金融数据（DSH 原生 MCP）

只使用下列 DSH 原生 MCP 工具，不要从 Bash 调用 Wind CLI，也不要读取、询问、打印或写入 WIND_API_KEY。

- 股票：\`mcp__wind_stock__*\`
- 基金：\`mcp__wind_fund__*\`
- 指数与板块：\`mcp__wind_index__*\`
- 债券：\`mcp__wind_bond__*\`
- 公告与新闻：\`mcp__wind_docs__*\`
- 宏观经济：\`mcp__wind_economic__*\`
- 跨标的分析：\`mcp__wind_analytics__*\`

优先选择专用域；先做最小请求探针，再扩展标的和字段。标的无法识别时请用户提供准确全称或 Wind 标准代码，不要猜交易所后缀。只依据 Wind 返回数据回答，保留单位、缺失值和警告。成功回答注明“数据来源于万得 Wind 金融数据服务”。`,
  }),
  Object.freeze({
    name: 'wind-alice',
    description: '通过 DSH 原生 wind_alice 工具调用万得 Alice 专业金融分析，包括公司一页纸、调研问题、财报点评、主题选股、事实核验、宏观、债券、信用、基金、市场规模和可比公司分析。',
    source: 'runtime',
    content: `# Wind Alice（DSH 原生工具）

只使用 \`wind_alice\` 工具，不要从 Bash 调用 Wind CLI，也不要读取、询问、打印或写入 WIND_API_KEY。

将用户的金融分析任务放入 \`prompt\`。明确对应某个专业工作流时选择 \`skill\`；否则省略，让 Alice 自动路由。不要把无关上下文、凭证或工作区文件原文发送给 Alice。原样保留返回结果的事实边界、来源和限制。`,
  }),
])

