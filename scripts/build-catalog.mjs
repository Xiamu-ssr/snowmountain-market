import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { z } from "zod";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const catalogRoot = join(root, "catalog");
const apiRoot = join(root, "public", "api");
const artifactsOutput = join(root, "public", "artifacts");
const publicBase = (process.env.PUBLIC_BASE_URL ?? "http://127.0.0.1:4320").replace(/\/$/, "");

const schema = z.object({
  type: z.enum(["skill", "mcp", "tool", "agent"]),
  title: z.string().min(1),
  description: z.string().min(1),
  resource: z.string().min(1),
  tags: z.array(z.string()).default([]),
  timestamp: z.union([z.string(), z.date()]),
  market: z.object({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
    version: z.string().min(1),
    artifact: z.string().min(1),
    runtime: z.string().min(1),
    permissions: z.array(z.string()).default([]),
    source: z.enum(["local", "remote"]).default("local")
  })
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

export async function buildCatalog() {
  await rm(apiRoot, { recursive: true, force: true });
  await rm(artifactsOutput, { recursive: true, force: true });
  await mkdir(join(apiRoot, "entries"), { recursive: true });
  await mkdir(artifactsOutput, { recursive: true });

  const documents = [];
  for (const path of (await markdownFiles(catalogRoot)).sort()) {
    const source = await readFile(path, "utf8");
    const parsed = matter(source);
    const metadata = schema.parse(parsed.data);
    const artifactPath = resolve(dirname(path), metadata.market.artifact);
    if (!insideRoot(artifactPath)) throw new Error(`Artifact escapes repository: ${artifactPath}`);
    const artifact = await readFile(artifactPath);
    const sha256 = createHash("sha256").update(artifact).digest("hex");
    const artifactName = `${metadata.market.id}-${metadata.market.version}${artifactPath.endsWith(".json") ? ".json" : ".tgz"}`;
    await cp(artifactPath, join(artifactsOutput, artifactName));

    const item = {
      id: metadata.market.id,
      type: metadata.type,
      title: metadata.title,
      description: metadata.description,
      version: metadata.market.version,
      tags: metadata.tags,
      resource: metadata.resource,
      downloadUrl: `${publicBase}/api/entries/${metadata.market.id}.json`,
      artifactUrl: `${publicBase}/artifacts/${artifactName}`,
      sha256,
      permissions: metadata.market.permissions,
      runtime: metadata.market.runtime,
      source: metadata.market.source,
      updatedAt: metadata.timestamp instanceof Date ? metadata.timestamp.toISOString() : metadata.timestamp,
      documentPath: relative(root, path)
    };
    documents.push(item);
    await writeFile(join(apiRoot, "entries", `${item.id}.json`), JSON.stringify({
      ...item,
      readme: parsed.content.trim(),
      install: {
        automatic: false,
        instructions: `Download ${item.artifactUrl}, verify SHA-256 ${sha256}, inspect the manifest, then follow its runtime-specific instructions.`
      }
    }, null, 2));
  }

  const index = {
    format: "snowmountain-market-catalog/v1",
    okf: "0.1-compatible",
    generatedAt: new Date().toISOString(),
    source: "git",
    items: documents
  };
  await writeFile(join(apiRoot, "catalog.json"), JSON.stringify(index, null, 2));
  return index;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await buildCatalog();
  console.log(`Built ${result.items.length} market entries -> public/api/catalog.json`);
}
