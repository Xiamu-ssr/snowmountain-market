import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isFeaturedWindSkill, windMcpEntries } from "./wind-curation.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "imports/external.json");
const syncedAt = new Date().toISOString();
const previousSnapshot = await readFile(output, "utf8").then((value) => JSON.parse(value)).catch(() => ({ items: [], sources: [] }));
const previousItems = previousSnapshot.items ?? [];
const previousSources = new Map((previousSnapshot.sources ?? []).map((source) => [source.id, source]));
const syncStatuses = new Map();

const sourceDefinitions = [
  {
    id: "clawhub",
    name: "ClawHub",
    type: "skill-registry",
    url: "https://clawhub.ai/",
    api: "https://clawhub.ai/api/v1/skills",
    strategy: "cached-public-metadata",
    note: "只缓存公开、非 suspicious 的目录元数据；不复制 Skill 内容，不继承上游信任。"
  },
  {
    id: "mcp-official",
    name: "Official MCP Registry",
    type: "mcp-registry",
    url: "https://registry.modelcontextprotocol.io/",
    api: "https://registry.modelcontextprotocol.io/v0.1/servers",
    strategy: "cached-registry-metadata",
    note: "只收录 active + latest 版本；命名空间验证不等于代码安全审计。"
  },
  {
    id: "wind-aifin",
    name: "Wind AIFin Market",
    type: "financial-capability-market",
    url: "https://aifinmarket.wind.com.cn/#/market",
    api: "https://aifinmarket.wind.com.cn/Wind.AIMarket.Service/mcp-config/skills",
    strategy: "cached-public-metadata",
    note: "缓存公开市场元数据；安装和 WIND_API_KEY 仍由 Wind 官方流程负责。"
  },
  {
    id: "tavily-official",
    name: "Tavily Official",
    type: "official-capability-repositories",
    url: "https://github.com/tavily-ai",
    api: "https://api.github.com/orgs/tavily-ai/repos",
    strategy: "cached-official-repository-metadata",
    note: "索引 Tavily 官方 MCP、Skills、Plugins 与 CLI；同一能力的不同制品类型分别展示。"
  },
  {
    id: "firecrawl-official",
    name: "Firecrawl Official",
    type: "official-capability-repositories",
    url: "https://github.com/firecrawl",
    api: "https://api.github.com/orgs/firecrawl/repos",
    strategy: "cached-official-repository-metadata",
    note: "索引 Firecrawl 官方 MCP、Skills、Plugins 与 CLI；凭证与安装仍由执行环境负责。"
  },
  {
    id: "skills-sh",
    name: "skills.sh",
    type: "skill-directory",
    url: "https://skills.sh/",
    api: "https://skills.sh/api/v1/skills",
    strategy: "source-only",
    status: "authentication-required",
    note: "官方 API 要求 Vercel OIDC；当前只登记来源，不抓取或绕过认证。"
  },
  {
    id: "anthropic-skills",
    name: "Anthropic Agent Skills",
    type: "official-skill-repository",
    url: "https://github.com/anthropics/skills",
    strategy: "source-only",
    status: "indexed-by-upstream-directories",
    note: "官方示例仓库；不同子目录许可证不同，安装前必须逐条确认。"
  }
];

function stableId(registry, value) {
  const slug = String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 72) || "entry";
  const hash = createHash("sha256").update(`${registry}:${value}`).digest("hex").slice(0, 8);
  return `${registry}-${slug}-${hash}`;
}

function compactTags(values) {
  return [...new Set(values.flatMap((value) => String(value ?? "").split(/[,/|]/)).map((value) => value.trim().toLowerCase()).filter(Boolean))].slice(0, 12);
}

function classify(type, text) {
  const value = String(text).toLowerCase();
  const rules = type === "mcp" ? [
    ["金融数据", /finance|financial|stock|fund|bond|金融|股票|基金|债券|宏观/],
    ["开发工具", /developer|code|github|gitlab|git\b|测试|代码|开发/],
    ["数据库", /database|sql|postgres|mysql|redis|数据库/],
    ["文件与知识", /document|filesystem|knowledge|file|文档|文件|知识/],
    ["搜索与浏览", /search|browser|crawl|搜索|浏览|检索/],
    ["协作 SaaS", /notion|linear|slack|calendar|email|crm|协作|日历|邮件/],
    ["云与基础设施", /cloud|kubernetes|docker|aws|azure|gcp|server|云|容器|服务器/],
    ["安全与身份", /security|audit|identity|auth|安全|审计|身份/]
  ] : [
    ["金融研究", /finance|financial|stock|fund|bond|trading|金融|股票|基金|债券|投研|估值|宏观|财报/],
    ["开发工作流", /developer|coding|code|github|gitlab|测试|代码|开发/],
    ["知识与研究", /research|search|knowledge|document|filesystem|研究|搜索|知识|文档/],
    ["数据分析", /data|database|sql|analytics|数据|分析/],
    ["效率协作", /productivity|task|calendar|notion|linear|slack|协作|任务|日历/],
    ["内容创作", /image|video|audio|design|pdf|presentation|内容|图像|视频|设计/],
    ["安全治理", /security|audit|policy|identity|auth|安全|审计|权限/],
    ["Agent 编排", /agent|model|llm|prompt|智能体|模型|提示词/]
  ];
  return rules.find(([, pattern]) => pattern.test(value))?.[0] ?? "通用";
}

async function fetchWithRetry(url, init) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
    } catch (error) {
      lastError = error;
      if (attempt < 1) await new Promise((resolveDelay) => setTimeout(resolveDelay, 300));
    }
  }
  throw lastError;
}

async function fetchJson(url, init) {
  const response = await fetchWithRetry(url, init);
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

const githubMetadata = new Map(Object.entries({
  "tavily-ai/tavily-mcp": { stargazers_count: 2273, pushed_at: "2026-07-25T10:16:46Z" },
  "tavily-ai/skills": { stargazers_count: 436, pushed_at: "2026-06-04T19:07:08Z" },
  "tavily-ai/tavily-cli": { stargazers_count: 11, pushed_at: "2026-07-20T13:31:53Z" },
  "tavily-ai/tavily-cursor-plugin": { stargazers_count: 1, pushed_at: "2026-07-28T14:58:50Z" },
  "tavily-ai/tavily-grok-plugin": { stargazers_count: 1, pushed_at: "2026-07-17T18:23:42Z" },
  "firecrawl/firecrawl-mcp-server": { stargazers_count: 7076, pushed_at: "2026-07-29T09:36:40Z" },
  "firecrawl/skills": { stargazers_count: 54, pushed_at: "2026-07-20T10:22:20Z" },
  "firecrawl/cli": { stargazers_count: 548, pushed_at: "2026-07-27T19:20:46Z" },
  "firecrawl/agent-browser-plugin-firecrawl": { stargazers_count: 6, pushed_at: "2026-06-17T00:18:30Z" },
  "firecrawl/firecrawl-grok-plugin": { stargazers_count: 7, pushed_at: "2026-06-12T06:56:02Z" }
}).map(([repository, metadata]) => [repository, Promise.resolve({
  ...metadata,
  default_branch: "main",
  html_url: `https://github.com/${repository}`
})]));

async function githubMeta(repository) {
  if (!githubMetadata.has(repository)) githubMetadata.set(repository, Promise.resolve({
    stargazers_count: 0,
    pushed_at: syncedAt,
    default_branch: "main",
    html_url: `https://github.com/${repository}`
  }));
  return githubMetadata.get(repository);
}

async function githubSkillEntries({ registry, repository, provider, license, credential, skillNames, featured = [] }) {
  const meta = await githubMeta(repository);
  const items = [];
  const loadSkill = (skillName) => {
    const rawUrl = `https://raw.githubusercontent.com/${repository}/${meta.default_branch}/skills/${skillName}/SKILL.md`;
    const title = skillName.replaceAll("-", " ").replace(/\b\w/g, (value) => value.toUpperCase());
    const description = `${provider} 官方 ${title} Agent Skill；提供可移植的 SKILL.md 工作流。`;
    const isFeatured = featured.includes(skillName);
    return {
      id: stableId(registry, `skill:${repository}:${skillName}`),
      upstreamId: skillName,
      type: "skill",
      title,
      description,
      version: "main",
      category: classify("skill", `${title} ${description}`),
      tags: compactTags([provider, "official", "agent-skill", skillName, ...(isFeatured ? ["精选"] : [])]),
      badges: ["官方", ...(isFeatured ? ["精选"] : [])],
      provider,
      registry,
      resource: `https://github.com/${repository}/tree/${meta.default_branch}/skills/${skillName}`,
      upstreamArtifactUrl: rawUrl,
      runtime: "agent-skill/SKILL.md",
      permissions: [`network:${provider.toLowerCase()}`, `credential:${credential}`],
      access: "account-and-api-key",
      license,
      verification: "publisher-repository",
      risk: ["external-provider", "web-content-untrusted", "human-review-required"],
      source: "remote",
      popularity: { stars: Number(meta.stargazers_count ?? 0) },
      updatedAt: meta.pushed_at || syncedAt,
      compatibility: {
        standard: "agentskills-compatible",
        clients: ["codex", "claude-code", "opencode", "agents-compatible"]
      }
    };
  };
  for (let index = 0; index < skillNames.length; index += 4) {
    items.push(...skillNames.slice(index, index + 4).map(loadSkill));
  }
  return items;
}

function officialEntry({ registry, provider, upstreamId, type, title, description, version, resource, runtime, license, credential, stars, updatedAt, featured = false, clients = [], permissions, risk = [] }) {
  const badges = ["官方", ...(featured ? ["精选"] : [])];
  const text = `${title} ${description}`;
  return {
    id: stableId(registry, `${type}:${upstreamId}`),
    upstreamId,
    type,
    title,
    description,
    version,
    category: classify(type, text),
    tags: compactTags([provider, type, classify(type, text), ...badges, ...clients]),
    badges,
    provider,
    registry,
    resource,
    upstreamArtifactUrl: resource,
    runtime,
    permissions: permissions ?? [`network:${provider.toLowerCase()}`, `credential:${credential}`],
    access: "account-and-api-key",
    license,
    verification: "publisher-repository",
    risk: ["external-provider", ...risk],
    source: "remote",
    popularity: { stars: Number(stars ?? 0) },
    updatedAt: updatedAt || syncedAt,
    compatibility: { clients }
  };
}

async function syncTavily() {
  const [mcpMeta, skillMeta, cliMeta, cursorMeta, grokMeta, skills] = await Promise.all([
    githubMeta("tavily-ai/tavily-mcp"),
    githubMeta("tavily-ai/skills"),
    githubMeta("tavily-ai/tavily-cli"),
    githubMeta("tavily-ai/tavily-cursor-plugin"),
    githubMeta("tavily-ai/tavily-grok-plugin"),
    githubSkillEntries({
      registry: "tavily-official", repository: "tavily-ai/skills", provider: "Tavily", license: "MIT", credential: "TAVILY_API_KEY",
      skillNames: ["tavily-best-practices", "tavily-cli", "tavily-crawl", "tavily-dynamic-search", "tavily-extract", "tavily-map", "tavily-research", "tavily-search"],
      featured: ["tavily-search", "tavily-extract", "tavily-crawl", "tavily-research"]
    })
  ]);
  const mcpPackage = { mcpName: "io.github.tavily-ai/tavily-mcp", description: "MCP server for advanced web search using Tavily", version: "0.2.21", license: "MIT" };
  const skillPlugin = { description: "Build AI applications with real-time web data using Tavily search, extract, crawl, and research APIs.", version: "1.0.0", license: "MIT" };
  const cursorPlugin = { displayName: "Tavily", description: "Web search, content extraction, crawling, deep research, and URL discovery powered by tvly CLI.", version: "2.0.0", license: "MIT" };
  const grokPlugin = { description: "Web search, extraction, crawling, discovery, and deep research for Grok Build via Tavily.", version: "1.0.0", license: "MIT" };
  return [
    officialEntry({
      registry: "tavily-official", provider: "Tavily", upstreamId: mcpPackage.mcpName, type: "mcp", title: "Tavily MCP",
      description: mcpPackage.description, version: mcpPackage.version, resource: mcpMeta.html_url, runtime: "mcp-streamable-http-or-stdio",
      license: mcpPackage.license, credential: "TAVILY_API_KEY", stars: mcpMeta.stargazers_count, updatedAt: mcpMeta.pushed_at, featured: true,
      clients: ["mcp-compatible"]
    }),
    ...skills,
    officialEntry({
      registry: "tavily-official", provider: "Tavily", upstreamId: "tavily-skills-plugin", type: "plugin", title: "Tavily Agent Skills Plugin",
      description: skillPlugin.description, version: skillPlugin.version, resource: skillMeta.html_url, runtime: "claude-plugin-with-agent-skills",
      license: skillPlugin.license, credential: "TAVILY_API_KEY", stars: skillMeta.stargazers_count, updatedAt: skillMeta.pushed_at, featured: true,
      clients: ["claude-code", "adapter-required:codex", "adapter-required:opencode"]
    }),
    officialEntry({
      registry: "tavily-official", provider: "Tavily", upstreamId: "tavily-cursor-plugin", type: "plugin", title: cursorPlugin.displayName || "Tavily Cursor Plugin",
      description: cursorPlugin.description, version: cursorPlugin.version, resource: cursorMeta.html_url, runtime: "cursor-plugin",
      license: cursorPlugin.license, credential: "TAVILY_API_KEY", stars: cursorMeta.stargazers_count, updatedAt: cursorMeta.pushed_at,
      clients: ["cursor"]
    }),
    officialEntry({
      registry: "tavily-official", provider: "Tavily", upstreamId: "tavily-grok-plugin", type: "plugin", title: "Tavily Grok Plugin",
      description: grokPlugin.description, version: grokPlugin.version, resource: grokMeta.html_url, runtime: "grok-plugin",
      license: grokPlugin.license, credential: "TAVILY_API_KEY", stars: grokMeta.stargazers_count, updatedAt: grokMeta.pushed_at,
      clients: ["grok-build"]
    }),
    officialEntry({
      registry: "tavily-official", provider: "Tavily", upstreamId: "tavily-cli", type: "cli", title: "Tavily CLI",
      description: "Search, extract, crawl, map, and research from the command line.", version: "0.1.5", resource: cliMeta.html_url, runtime: "python-cli:tvly",
      license: "MIT", credential: "TAVILY_API_KEY", stars: cliMeta.stargazers_count, updatedAt: cliMeta.pushed_at, featured: true,
      clients: ["shell", "managed-sandbox"]
    })
  ];
}

async function syncFirecrawl() {
  const [mcpMeta, cliMeta, browserPluginMeta, grokMeta, skills, cliSkills] = await Promise.all([
    githubMeta("firecrawl/firecrawl-mcp-server"),
    githubMeta("firecrawl/cli"),
    githubMeta("firecrawl/agent-browser-plugin-firecrawl"),
    githubMeta("firecrawl/firecrawl-grok-plugin"),
    githubSkillEntries({
      registry: "firecrawl-official", repository: "firecrawl/skills", provider: "Firecrawl", license: "ISC", credential: "FIRECRAWL_API_KEY",
      skillNames: ["firecrawl-build", "firecrawl-build-interact", "firecrawl-build-onboarding", "firecrawl-build-scrape", "firecrawl-build-search", "firecrawl-research-index"],
      featured: ["firecrawl-build-search", "firecrawl-build-scrape", "firecrawl-research-index"]
    }),
    githubSkillEntries({
      registry: "firecrawl-official", repository: "firecrawl/cli", provider: "Firecrawl", license: "ISC", credential: "FIRECRAWL_API_KEY",
      skillNames: ["firecrawl-agent", "firecrawl-cli", "firecrawl-crawl", "firecrawl-download", "firecrawl-interact", "firecrawl-map", "firecrawl-monitor", "firecrawl-parse", "firecrawl-scrape", "firecrawl-search"],
      featured: ["firecrawl-search", "firecrawl-scrape", "firecrawl-crawl", "firecrawl-interact"]
    })
  ]);
  const mcpPackage = { mcpName: "io.github.firecrawl/firecrawl-mcp-server", description: "Official Firecrawl MCP server for web search, scraping, interaction, batch processing, and extraction.", version: "3.23.0", license: "MIT" };
  const cliPackage = { description: "Command-line interface for Firecrawl. Scrape, crawl, and extract data from websites.", version: "1.19.27", license: "ISC" };
  const browserPlugin = { description: "Firecrawl plugin for agent-browser: cloud browser provider plus scrape, search, crawl, and map commands.", version: "0.1.0", license: "MIT" };
  const grokPlugin = { description: "Scrape, search, crawl, map, and extract the web via Firecrawl MCP or CLI skills.", version: "1.1.0", license: "AGPL-3.0" };
  return [
    officialEntry({
      registry: "firecrawl-official", provider: "Firecrawl", upstreamId: mcpPackage.mcpName, type: "mcp", title: "Firecrawl MCP",
      description: mcpPackage.description, version: mcpPackage.version, resource: mcpMeta.html_url, runtime: "mcp-streamable-http-or-stdio",
      license: mcpPackage.license, credential: "FIRECRAWL_API_KEY", stars: mcpMeta.stargazers_count, updatedAt: mcpMeta.pushed_at, featured: true,
      clients: ["mcp-compatible"]
    }),
    ...skills,
    ...cliSkills,
    officialEntry({
      registry: "firecrawl-official", provider: "Firecrawl", upstreamId: "agent-browser-plugin-firecrawl", type: "plugin", title: "Firecrawl Agent Browser Plugin",
      description: browserPlugin.description, version: browserPlugin.version, resource: browserPluginMeta.html_url, runtime: "agent-browser.plugin.v1",
      license: browserPlugin.license, credential: "FIRECRAWL_API_KEY", stars: browserPluginMeta.stargazers_count, updatedAt: browserPluginMeta.pushed_at, featured: true,
      clients: ["agent-browser"]
    }),
    officialEntry({
      registry: "firecrawl-official", provider: "Firecrawl", upstreamId: "firecrawl-grok-plugin", type: "plugin", title: "Firecrawl Grok Plugin",
      description: grokPlugin.description, version: grokPlugin.version, resource: grokMeta.html_url, runtime: "grok-plugin",
      license: grokPlugin.license, credential: "FIRECRAWL_API_KEY", stars: grokMeta.stargazers_count, updatedAt: grokMeta.pushed_at,
      clients: ["grok-build"]
    }),
    officialEntry({
      registry: "firecrawl-official", provider: "Firecrawl", upstreamId: "firecrawl-cli", type: "cli", title: "Firecrawl CLI",
      description: cliPackage.description, version: cliPackage.version, resource: cliMeta.html_url, runtime: "node-cli:firecrawl",
      license: cliPackage.license, credential: "FIRECRAWL_API_KEY", stars: cliMeta.stargazers_count, updatedAt: cliMeta.pushed_at, featured: true,
      clients: ["shell", "managed-sandbox"]
    })
  ];
}

async function syncWithFallback(registry, operation) {
  try {
    const items = await operation();
    syncStatuses.set(registry, "synced");
    return items;
  } catch (error) {
    const cached = previousItems.filter((item) => item.registry === registry);
    if (!cached.length) throw error;
    syncStatuses.set(registry, "cached-fallback");
    console.warn(`${registry} refresh failed; keeping ${cached.length} cached entries`);
    return cached;
  }
}

async function syncClawHub(maxItems = Number(process.env.CLAWHUB_LIMIT ?? 400)) {
  const items = [];
  let cursor = "";
  while (items.length < maxItems) {
    const url = new URL("https://clawhub.ai/api/v1/skills");
    url.searchParams.set("limit", String(Math.min(200, maxItems - items.length)));
    url.searchParams.set("sort", "downloads");
    url.searchParams.set("nonSuspiciousOnly", "true");
    if (cursor) url.searchParams.set("cursor", cursor);
    const page = await fetchJson(url);
    items.push(...(page.items ?? []));
    if (!page.nextCursor) break;
    cursor = page.nextCursor;
  }
  return items.map((skill) => {
    const text = `${skill.displayName} ${skill.summary} ${(skill.topics ?? []).join(" ")}`;
    return {
      id: stableId("clawhub", skill.slug),
      upstreamId: skill.slug,
      type: "skill",
      title: skill.displayName || skill.slug,
      description: skill.summary || skill.description || "ClawHub public Skill",
      version: skill.latestVersion?.version || skill.tags?.latest || "latest",
      category: classify("skill", text),
      tags: compactTags([...(skill.topics ?? []), "clawhub", "agent-skill"]),
      provider: "ClawHub community",
      registry: "clawhub",
      resource: `https://clawhub.ai/skills/${encodeURIComponent(skill.slug)}`,
      upstreamArtifactUrl: `https://clawhub.ai/api/v1/download?slug=${encodeURIComponent(skill.slug)}`,
      runtime: "agent-skill/SKILL.md",
      permissions: ["unknown:review-required"],
      access: "unknown",
      license: skill.latestVersion?.license || "unknown",
      verification: "registry-listed",
      risk: ["unreviewed-code", "prompt-injection", "supply-chain"],
      source: "remote",
      popularity: {
        downloads: Number(skill.stats?.downloads ?? 0),
        installs: Number(skill.stats?.installs ?? 0),
        stars: Number(skill.stats?.stars ?? 0)
      },
      updatedAt: new Date(Number(skill.updatedAt ?? Date.now())).toISOString()
    };
  });
}

async function syncMcp(maxPages = Number(process.env.MCP_MAX_PAGES ?? 10)) {
  const records = [];
  let cursor = "";
  for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
    const url = new URL("https://registry.modelcontextprotocol.io/v0.1/servers");
    url.searchParams.set("limit", "100");
    if (cursor) url.searchParams.set("cursor", cursor);
    const page = await fetchJson(url);
    records.push(...(page.servers ?? []));
    if (!page.metadata?.nextCursor) break;
    cursor = page.metadata.nextCursor;
  }
  const latest = new Map();
  for (const record of records) {
    const official = record._meta?.["io.modelcontextprotocol.registry/official"] ?? {};
    if (!official.isLatest || official.status !== "active") continue;
    latest.set(record.server.name, record);
  }
  return [...latest.values()].map((record) => {
    const server = record.server;
    const official = record._meta["io.modelcontextprotocol.registry/official"];
    const text = `${server.title} ${server.name} ${server.description}`;
    const remote = server.remotes?.[0];
    const packageInfo = server.packages?.[0];
    return {
      id: stableId("mcp", server.name),
      upstreamId: server.name,
      type: "mcp",
      title: server.title || server.name,
      description: server.description || "Official MCP Registry server",
      version: server.version,
      category: classify("mcp", text),
      tags: compactTags(["mcp", classify("mcp", text), ...(remote ? [remote.type] : []), ...(packageInfo?.registryType ? [packageInfo.registryType] : [])]),
      provider: server.name.split("/")[0],
      registry: "mcp-official",
      resource: `https://registry.modelcontextprotocol.io/v0.1/servers/${encodeURIComponent(server.name)}/versions/latest`,
      upstreamArtifactUrl: remote?.url || packageInfo?.identifier,
      runtime: remote ? `mcp-${remote.type}` : packageInfo ? `mcp-${packageInfo.registryType ?? "package"}` : "mcp-server-json",
      permissions: ["network:provider", "credentials:provider-dependent"],
      access: "provider-dependent",
      license: "upstream-defined",
      verification: "namespace-verified",
      risk: ["not-security-audited", "tool-output-untrusted"],
      source: "remote",
      popularity: {},
      updatedAt: official.updatedAt || official.publishedAt || syncedAt,
      transport: remote ? { type: remote.type, url: remote.url } : undefined,
      package: packageInfo ? { registryType: packageInfo.registryType, identifier: packageInfo.identifier } : undefined
    };
  });
}

async function syncWind() {
  const payload = await fetchJson("https://aifinmarket.wind.com.cn/Wind.AIMarket.Service/mcp-config/skills", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ pageNum: 1, pageSize: 1000 })
  });
  if (payload.code !== 0 || !Array.isArray(payload.data?.records)) throw new Error("Wind returned an invalid public skill catalog");
  const skills = payload.data.records.map((skill) => {
    const title = skill.nameCn || skill.nameEn || skill.name;
    const upstreamId = String(skill.name || skill.id);
    const featured = isFeaturedWindSkill({ upstreamId });
    const publisherOfficial = ["Wind", "Wind Alice"].includes(skill.source);
    return {
      id: stableId("wind", `${skill.id}:${skill.name}`),
      upstreamId,
      type: "skill",
      title,
      description: skill.descriptionCn || skill.descriptionEn || "Wind AIFin Market Skill",
      version: String(skill.version || "latest"),
      category: "金融研究",
      tags: compactTags(["wind", "finance", skill.categoryCn, skill.subCategoryCn, skill.source, ...(publisherOfficial ? ["官方"] : []), ...(featured ? ["精选"] : [])]),
      badges: [...(publisherOfficial ? ["官方"] : []), ...(featured ? ["精选"] : [])],
      provider: skill.source || "Wind AIFin Market",
      registry: "wind-aifin",
      resource: `https://github.com/Wind-Information-Co-Ltd/wind-skills/tree/main/skills/${upstreamId}`,
      upstreamArtifactUrl: `https://raw.githubusercontent.com/Wind-Information-Co-Ltd/wind-skills/main/skills/${upstreamId}/SKILL.md`,
      runtime: "agent-skill/SKILL.md",
      permissions: ["network:wind-provider", "credential:WIND_API_KEY"],
      access: "account-and-api-key",
      license: "provider-terms",
      verification: ["Wind", "Wind Alice"].includes(skill.source) ? "publisher-listed" : "registry-listed",
      risk: ["financial-data", "external-provider", "human-review-required"],
      source: "remote",
      popularity: { downloads: Number(skill.downloadCount ?? 0) },
      updatedAt: syncedAt
    };
  });
  const discovery = {
    id: stableId("wind", "wind-find-finance-skill"), upstreamId: "wind-find-finance-skill", type: "skill",
    title: "Wind 金融能力发现", description: "Wind 官方金融能力入口：按问题发现并安装数据底座与专业研究工作流。",
    version: "latest", category: "金融研究", tags: ["wind", "finance", "能力发现", "官方", "精选"], badges: ["官方", "精选"],
    provider: "Wind", registry: "wind-aifin",
    resource: "https://github.com/Wind-Information-Co-Ltd/wind-skills/tree/main/skills/wind-find-finance-skill",
    upstreamArtifactUrl: "https://raw.githubusercontent.com/Wind-Information-Co-Ltd/wind-skills/main/skills/wind-find-finance-skill/SKILL.md",
    runtime: "agent-skill/SKILL.md", permissions: ["network:wind-skills", "filesystem:skill-install"], access: "public",
    license: "provider-terms", verification: "publisher-listed", risk: ["external-provider", "human-review-required"],
    source: "remote", popularity: {}, updatedAt: syncedAt
  };
  const mcps = windMcpEntries.map(([slug, title, category, description, toolCount]) => ({
    id: stableId("wind-mcp", slug), upstreamId: slug, type: "mcp", title, description,
    version: "provider-managed", category: "金融数据",
    tags: compactTags(["wind", "mcp", "finance", category, `${toolCount}-tools`, "官方", "精选"]), badges: ["官方", "精选"],
    provider: "Wind", registry: "wind-aifin", resource: "https://aifinmarket.wind.com.cn/#/market",
    upstreamArtifactUrl: "https://aifinmarket.wind.com.cn/skill.md", runtime: "mcp-provider-managed",
    permissions: ["network:wind-provider", "credential:WIND_API_KEY"], access: "account-and-api-key",
    license: "provider-terms", verification: "publisher-listed",
    risk: ["financial-data", "external-provider"], source: "remote", popularity: {}, updatedAt: syncedAt
  }));
  return [discovery, ...skills, ...mcps];
}

const groups = await Promise.all([
  syncWithFallback("clawhub", syncClawHub),
  syncWithFallback("mcp-official", syncMcp),
  syncWithFallback("wind-aifin", syncWind),
  syncTavily(),
  syncFirecrawl()
]);
const items = groups.flat();
const sources = sourceDefinitions.map((source) => ({
  ...source,
  status: source.status ?? syncStatuses.get(source.id) ?? "synced",
  itemCount: items.filter((item) => item.registry === source.id).length,
  syncedAt: items.some((item) => item.registry === source.id)
    ? syncStatuses.get(source.id) === "cached-fallback" ? previousSources.get(source.id)?.syncedAt : syncedAt
    : undefined
}));

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify({ format: "snowmountain.market.imports/v2", syncedAt, sources, items }, null, 2)}\n`, "utf8");
console.log(`Synced ${items.length} external entries from ${sources.filter((source) => source.status === "synced").length} sources`);
