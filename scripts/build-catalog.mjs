import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { z } from "zod";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const catalogRoot = join(root, "catalog");
const importsPath = join(root, "imports", "external.json");
const apiRoot = join(root, "public", "api");
const artifactsOutput = join(root, "public", "artifacts");
const publicBase = (process.env.PUBLIC_BASE_URL ?? "http://127.0.0.1:4320").replace(/\/$/, "");

const entryType = z.enum(["skill", "mcp", "plugin", "cli"]);
const importedEntryType = z.enum(["skill", "mcp", "plugin", "cli", "tool", "agent"]);
const metadataSchema = z.object({
  type: entryType,
  title: z.string().min(1),
  description: z.string().min(1),
  resource: z.string().min(1),
  tags: z.array(z.string()).default([]),
  badges: z.array(z.string()).default([]),
  timestamp: z.union([z.string(), z.date()]),
  category: z.string().optional(),
  provider: z.string().optional(),
  license: z.string().optional(),
  market: z.object({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
    version: z.string().min(1),
    artifact: z.string().min(1),
    runtime: z.string().min(1),
    permissions: z.array(z.string()).default([]),
    source: z.enum(["local", "remote"]).default("local")
  })
});

const importedEntrySchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  upstreamId: z.string(),
  type: importedEntryType,
  title: z.string().min(1),
  description: z.string().min(1),
  version: z.string().min(1),
  category: z.string().min(1),
  tags: z.array(z.string()),
  badges: z.array(z.string()).optional(),
  provider: z.string().min(1),
  registry: z.string().min(1),
  resource: z.string().url(),
  upstreamArtifactUrl: z.string().optional(),
  runtime: z.string().min(1),
  permissions: z.array(z.string()),
  access: z.string(),
  license: z.string(),
  verification: z.string(),
  risk: z.array(z.string()),
  source: z.literal("remote"),
  popularity: z.object({ downloads: z.number().optional(), installs: z.number().optional(), stars: z.number().optional() }),
  updatedAt: z.string()
}).passthrough();

const importsSchema = z.object({
  format: z.enum(["snowmountain.market.imports/v1", "snowmountain.market.imports/v2"]),
  syncedAt: z.string(),
  sources: z.array(z.object({ id: z.string(), name: z.string(), type: z.string(), url: z.string().url(), strategy: z.string(), status: z.string(), itemCount: z.number(), note: z.string() }).passthrough()),
  items: z.array(importedEntrySchema)
});

async function markdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await markdownFiles(path));
    else if (entry.name.endsWith(".md")) result.push(path);
  }
  return result;
}

function insideRoot(path) {
  return path === root || path.startsWith(`${root}${sep}`);
}

export function classify(type, text) {
  const value = String(text).toLowerCase();
  const rules = {
    skill: [
      ["金融研究", /finance|financial|stock|fund|bond|trading|portfolio|金融|股票|基金|债券|投研|估值|宏观|财报/],
      ["开发工作流", /developer|development|coding|code|github|gitlab|测试|代码|开发/],
      ["知识与研究", /research|search|knowledge|document|filesystem|研究|搜索|知识|文档/],
      ["数据分析", /data|database|sql|analytics|数据|分析/],
      ["效率协作", /productivity|project|task|calendar|notion|linear|slack|协作|任务|日历|办公/],
      ["内容创作", /image|video|audio|media|design|pdf|presentation|内容|图像|视频|音频|设计/],
      ["安全治理", /security|audit|policy|identity|auth|安全|审计|权限|身份/],
      ["Agent 编排", /agent|model|llm|prompt|智能体|模型|提示词/]
    ],
    mcp: [
      ["金融数据", /finance|financial|stock|fund|bond|trading|金融|股票|基金|债券|宏观|财报/],
      ["开发工具", /developer|code|github|gitlab|git\b|测试|代码|开发/],
      ["数据库", /database|sql|postgres|mysql|redis|数据库/],
      ["文件与知识", /document|filesystem|knowledge|file|文档|文件|知识/],
      ["搜索与浏览", /search|browser|crawl|搜索|浏览|检索/],
      ["协作 SaaS", /notion|linear|slack|calendar|email|crm|协作|日历|邮件/],
      ["云与基础设施", /cloud|kubernetes|docker|aws|azure|gcp|server|云|容器|服务器/],
      ["安全与身份", /security|audit|identity|auth|安全|审计|身份|鉴权/]
    ],
    plugin: [
      ["开发套件", /developer|coding|code|github|开发|代码/],
      ["数据与研究", /data|research|search|数据|研究|搜索/],
      ["效率协作", /productivity|task|calendar|slack|notion|效率|协作/],
      ["内容创作", /image|video|audio|design|presentation|内容|设计/],
      ["金融", /finance|stock|fund|金融|股票|基金/],
      ["安全治理", /security|audit|policy|安全|审计/]
    ],
    cli: [
      ["开发工具", /developer|coding|code|git|开发|代码/],
      ["运维与云", /cloud|kubernetes|docker|server|infra|云|容器|运维/],
      ["数据工具", /data|database|sql|数据|数据库/],
      ["安全工具", /security|audit|auth|安全|审计/],
      ["媒体处理", /image|video|audio|media|图像|视频|音频/]
    ]
  };
  return rules[type]?.find(([, pattern]) => pattern.test(value))?.[0] ?? "通用";
}

function localCategory(type, text) {
  return classify(type, text);
}

const featuredWindSkills = new Set([
  "万得金融数据", "财报解读", "DCF 估值模型", "个股投资逻辑研究", "上市公司一页纸投资报告",
  "金融事实核验", "宏观数据解读", "基金筛选与投资建议", "债券利率走势研判", "全球上市公司财报点评"
]);

export function normalizeImported(item) {
  if (!entryType.safeParse(item.type).success) return undefined;
  const featured = item.registry === "wind-aifin" && (item.type === "mcp" || featuredWindSkills.has(item.title));
  const badges = [...new Set([
    ...(item.badges ?? []),
    ...(item.registry === "wind-aifin" ? ["官方"] : []),
    ...(featured ? ["精选"] : [])
  ])];
  const text = `${item.title} ${item.description} ${item.category} ${item.tags.join(" ")}`;
  return {
    ...item,
    category: classify(item.type, text),
    tags: [...new Set([...item.tags, ...badges])],
    badges
  };
}

function popularityScore(item) {
  return Number(item.popularity?.downloads ?? 0) + Number(item.popularity?.installs ?? 0) * 10 + Number(item.popularity?.stars ?? 0) * 100;
}

async function writeDetail(item, extra = {}) {
  await writeFile(join(apiRoot, "entries", `${item.id}.json`), JSON.stringify({
    ...item,
    ...extra,
    install: {
      automatic: false,
      instructions: item.artifactUrl
        ? `下载 ${item.artifactUrl}，核对 SHA-256 ${item.sha256}，审查 Manifest 后按运行时说明安装。`
        : `前往上游 ${item.resource} 核对许可证、权限、版本和安装方法；雪山 Market 不代理安装或凭证。`
    }
  }, null, 2));
}

export async function buildCatalog() {
  await rm(apiRoot, { recursive: true, force: true });
  await rm(artifactsOutput, { recursive: true, force: true });
  await mkdir(join(apiRoot, "entries"), { recursive: true });
  await mkdir(artifactsOutput, { recursive: true });

  const localItems = [];
  for (const path of (await markdownFiles(catalogRoot)).sort()) {
    const source = await readFile(path, "utf8");
    const parsed = matter(source);
    const metadata = metadataSchema.parse(parsed.data);
    const artifactPath = resolve(dirname(path), metadata.market.artifact);
    if (!insideRoot(artifactPath)) throw new Error(`Artifact escapes repository: ${artifactPath}`);
    const artifact = await readFile(artifactPath);
    const sha256 = createHash("sha256").update(artifact).digest("hex");
    const artifactName = `${metadata.market.id}-${metadata.market.version}${artifactPath.endsWith(".json") ? ".json" : ".tgz"}`;
    await cp(artifactPath, join(artifactsOutput, artifactName));
    const item = {
      id: metadata.market.id,
      upstreamId: metadata.market.id,
      type: metadata.type,
      title: metadata.title,
      description: metadata.description,
      version: metadata.market.version,
      category: metadata.category ?? localCategory(metadata.type, `${metadata.title} ${metadata.description} ${metadata.tags.join(" ")}`),
      tags: metadata.tags,
      badges: [...new Set(["雪山精选", ...metadata.badges])],
      provider: metadata.provider ?? "Snowmountain",
      registry: "snowmountain",
      resource: metadata.resource,
      downloadUrl: `${publicBase}/api/entries/${metadata.market.id}.json`,
      artifactUrl: `${publicBase}/artifacts/${artifactName}`,
      sha256,
      permissions: metadata.market.permissions,
      runtime: metadata.market.runtime,
      access: "free",
      license: metadata.license ?? "repository-defined",
      verification: "snowmountain-reviewed",
      risk: [],
      popularity: {},
      source: metadata.market.source,
      updatedAt: metadata.timestamp instanceof Date ? metadata.timestamp.toISOString() : metadata.timestamp,
      documentPath: relative(root, path)
    };
    localItems.push(item);
    await writeDetail(item, { readme: parsed.content.trim() });
  }

  const imported = importsSchema.parse(JSON.parse(await readFile(importsPath, "utf8")));
  const remoteItems = imported.items.map(normalizeImported).filter(Boolean).map((item) => ({
    ...item,
    downloadUrl: `${publicBase}/api/entries/${item.id}.json`
  }));
  for (const item of remoteItems) await writeDetail(item, { syncedAt: imported.syncedAt });

  const allItems = [...localItems, ...remoteItems];
  const ids = new Set();
  for (const item of allItems) {
    if (ids.has(item.id)) throw new Error(`Duplicate catalog ID: ${item.id}`);
    ids.add(item.id);
  }
  const items = allItems.sort((left, right) => {
    if (left.registry === "snowmountain" && right.registry !== "snowmountain") return -1;
    if (right.registry === "snowmountain" && left.registry !== "snowmountain") return 1;
    return popularityScore(right) - popularityScore(left) || left.title.localeCompare(right.title);
  });
  const sources = [
    { id: "snowmountain", name: "Snowmountain curated", type: "curated-local", url: "https://github.com/Xiamu-ssr/snowmountain-market", strategy: "git-reviewed", status: "synced", itemCount: localItems.length, note: "仓库内人工审查的 Manifest 与固定制品。" },
    ...imported.sources
  ];
  const index = {
    format: "snowmountain-market-catalog/v3",
    compatibleFormats: [],
    okf: "0.1-compatible",
    generatedAt: new Date().toISOString(),
    importedAt: imported.syncedAt,
    source: "git",
    sources,
    summary: {
      entries: items.length,
      types: Object.fromEntries(["mcp", "skill", "plugin", "cli"].map((type) => [type, items.filter((item) => item.type === type).length])),
      categoriesByType: Object.fromEntries(["mcp", "skill", "plugin", "cli"].map((type) => [type, Object.fromEntries(
        [...new Set(items.filter((item) => item.type === type).map((item) => item.category))].sort().map((category) => [category, items.filter((item) => item.type === type && item.category === category).length])
      )]))
    },
    items
  };
  await writeFile(join(apiRoot, "catalog.json"), JSON.stringify(index, null, 2));
  return index;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await buildCatalog();
  console.log(`Built ${result.items.length} market entries -> public/api/catalog.json`);
}
