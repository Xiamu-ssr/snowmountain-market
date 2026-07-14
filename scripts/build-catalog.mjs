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

const entryType = z.enum(["skill", "mcp", "tool", "agent"]);
const metadataSchema = z.object({
  type: entryType,
  title: z.string().min(1),
  description: z.string().min(1),
  resource: z.string().min(1),
  tags: z.array(z.string()).default([]),
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
  type: entryType,
  title: z.string().min(1),
  description: z.string().min(1),
  version: z.string().min(1),
  category: z.string().min(1),
  tags: z.array(z.string()),
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
  format: z.literal("snowmountain.market.imports/v1"),
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

function localCategory(type) {
  return { skill: "数据与知识", mcp: "开发工程", tool: "开发工程", agent: "AI 与模型" }[type];
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
      category: metadata.category ?? localCategory(metadata.type),
      tags: metadata.tags,
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
  const remoteItems = imported.items.map((item) => ({
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
    format: "snowmountain-market-catalog/v2",
    compatibleFormats: ["snowmountain-market-catalog/v1"],
    okf: "0.1-compatible",
    generatedAt: new Date().toISOString(),
    importedAt: imported.syncedAt,
    source: "git",
    sources,
    summary: {
      entries: items.length,
      types: Object.fromEntries(["skill", "mcp", "tool", "agent"].map((type) => [type, items.filter((item) => item.type === type).length])),
      categories: Object.fromEntries([...new Set(items.map((item) => item.category))].sort().map((category) => [category, items.filter((item) => item.category === category).length]))
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
