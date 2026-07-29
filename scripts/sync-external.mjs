import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isFeaturedWindSkill, windMcpEntries } from "./wind-curation.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "imports/external.json");
const syncedAt = new Date().toISOString();

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

async function fetchJson(url, init) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
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

const groups = await Promise.all([syncClawHub(), syncMcp(), syncWind()]);
const items = groups.flat();
const sources = sourceDefinitions.map((source) => ({
  ...source,
  status: source.status ?? "synced",
  itemCount: items.filter((item) => item.registry === source.id).length,
  syncedAt: items.some((item) => item.registry === source.id) ? syncedAt : undefined
}));

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify({ format: "snowmountain.market.imports/v2", syncedAt, sources, items }, null, 2)}\n`, "utf8");
console.log(`Synced ${items.length} external entries from ${sources.filter((source) => source.status === "synced").length} sources`);
