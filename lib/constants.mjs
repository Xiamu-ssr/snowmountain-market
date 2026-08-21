export const DEFAULT_API_KEY_ENV = 'WIND_API_KEY'
export const DEFAULT_MCP_TIMEOUT_MS = 600_000
export const DEFAULT_ALICE_TIMEOUT_MS = 900_000
export const WIND_ALICE_ENDPOINT = 'https://mcp.wind.com.cn/skills/alice'

export const MCP_DOMAINS = Object.freeze([
  Object.freeze({
    id: 'stock_data',
    serverName: 'wind_stock',
    endpoint: 'https://mcp.wind.com.cn/vserver_stock_data/mcp/',
  }),
  Object.freeze({
    id: 'fund_data',
    serverName: 'wind_fund',
    endpoint: 'https://mcp.wind.com.cn/vserver_fund_data/mcp/',
  }),
  Object.freeze({
    id: 'index_data',
    serverName: 'wind_index',
    endpoint: 'https://mcp.wind.com.cn/vserver_index_data/mcp/',
  }),
  Object.freeze({
    id: 'bond_data',
    serverName: 'wind_bond',
    endpoint: 'https://mcp.wind.com.cn/vserver_bond_data/mcp/',
  }),
  Object.freeze({
    id: 'financial_docs',
    serverName: 'wind_docs',
    endpoint: 'https://mcp.wind.com.cn/vserver_financial_docs/mcp/',
  }),
  Object.freeze({
    id: 'economic_data',
    serverName: 'wind_economic',
    endpoint: 'https://mcp.wind.com.cn/vserver_economic_data/mcp/',
  }),
  Object.freeze({
    id: 'analytics_data',
    serverName: 'wind_analytics',
    endpoint: 'https://mcp.wind.com.cn/vserver_analytics_data/mcp/',
  }),
])

export const ALICE_SKILLS = Object.freeze([
  Object.freeze({ zh: '通胀情景债券轮动策略', en: 'Inflation Bond Strategy' }),
  Object.freeze({ zh: '宏观数据解读', en: 'Macro Data Interpretation' }),
  Object.freeze({ zh: '按主题选股', en: 'Thematic Stock Screening' }),
  Object.freeze({ zh: '债券利率走势研判', en: 'Bond Rate Outlook' }),
  Object.freeze({ zh: '信用分析', en: 'Credit Analysis' }),
  Object.freeze({ zh: '基金对比分析', en: 'Fund Compare' }),
  Object.freeze({ zh: '基金筛选与投资建议', en: 'Fund Screening & Investment Advisory' }),
  Object.freeze({ zh: '投资标的创意与筛选', en: 'Investment Idea Generation' }),
  Object.freeze({ zh: '公司一页纸', en: 'Company One-Page Investment Memo' }),
  Object.freeze({ zh: '上市公司调研问题清单', en: 'Stock DD List' }),
  Object.freeze({ zh: '全球上市公司季报点评', en: 'Global Share Quarterly Earnings Review' }),
  Object.freeze({ zh: '市场规模测算与战略建模', en: 'Market Sizing & Strategic Modeling' }),
  Object.freeze({ zh: '可比公司分析', en: 'Comps Analysis' }),
  Object.freeze({ zh: '事实核验', en: 'Fact Check' }),
])

