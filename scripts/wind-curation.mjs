export const featuredWindSkillSlugs = new Set([
  "wind-find-finance-skill",
  "wind-mcp-skill",
  "stock_first_look_skill",
  "earnings-analysis",
  "dcf-model",
  "equity-investment-thesis",
  "post-market-debrief",
  "a-share-primary-theme-identification",
  "market-environment-analysis",
  "bull_bear_case_builder_skill"
]);

export const windMcpEntries = [
  ["stock_data", "万得股票数据", "股票", "A 股、港股与美股筛选、行情、K 线、财务、股东、事件、技术与风险数据。", 10],
  ["fund_data", "万得基金数据", "基金", "基金、ETF 与 LOF 的筛选、行情、档案、财务、持仓、业绩、持有人与管理公司数据。", 10],
  ["index_data", "万得指数与板块数据", "指数与板块", "指数与板块行情、K 线、分钟行情、档案、基本面与技术指标。", 6],
  ["bond_data", "万得债券数据", "债券", "债券档案、发行主体、行情估值与主体财务数据。", 4],
  ["financial_docs", "万得公告与新闻", "公告与新闻", "检索公司公告、年报、季报、招股书、财经新闻与快讯。", 2],
  ["economic_data", "万得宏观与行业指标", "宏观与行业", "GDP、CPI、PPI、PMI、社融、利率及行业经济时间序列。", 1],
  ["analytics_data", "万得通用结构化取数", "通用取数", "专项数据路由无法覆盖时使用的通用结构化金融取数。", 1]
];

export function isFeaturedWindSkill(item) {
  return featuredWindSkillSlugs.has(String(item.upstreamId ?? item.name ?? ""));
}
