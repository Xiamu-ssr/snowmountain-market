import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildCatalog } from "../scripts/build-catalog.mjs";

test("builds the reviewed and imported catalog with provenance", async () => {
  const catalog = await buildCatalog();
  assert.equal(catalog.format, "snowmountain-market-catalog/v3");
  assert.ok(catalog.items.length >= 700);
  assert.deepEqual(catalog.items.slice(0, 2).map((item) => item.id), [
    "filesystem-readonly-mcp",
    "workspace-researcher"
  ]);
  assert.ok(catalog.items.every((item) => ["mcp", "skill", "plugin", "cli"].includes(item.type)));
  assert.equal(catalog.items.some((item) => ["tool", "agent"].includes(item.type)), false);
  assert.deepEqual(Object.keys(catalog.summary.types), ["mcp", "skill", "plugin", "cli"]);
  assert.ok(catalog.summary.categoriesByType.skill["金融研究"] > 0);
  assert.ok(catalog.summary.categoriesByType.mcp["金融数据"] > 0);
  assert.equal(new Set(catalog.items.map((item) => item.id)).size, catalog.items.length);
  assert.equal(catalog.sources.find((source) => source.id === "clawhub")?.itemCount, 400);
  assert.equal(catalog.sources.find((source) => source.id === "wind-aifin")?.itemCount, 98);
  assert.ok((catalog.sources.find((source) => source.id === "mcp-official")?.itemCount ?? 0) > 250);
  assert.ok((catalog.sources.find((source) => source.id === "tavily-official")?.itemCount ?? 0) >= 10);
  assert.ok((catalog.sources.find((source) => source.id === "firecrawl-official")?.itemCount ?? 0) >= 15);
  assert.ok(catalog.summary.types.plugin >= 5);
  assert.ok(catalog.summary.types.cli >= 2);
  assert.ok(catalog.items.some((item) => item.registry === "tavily-official" && item.type === "mcp" && item.badges.includes("精选")));
  assert.ok(catalog.items.some((item) => item.registry === "firecrawl-official" && item.type === "skill" && item.badges.includes("官方")));
  for (const item of catalog.items.filter((entry) => entry.registry === "snowmountain")) {
    assert.match(item.sha256, /^[0-9a-f]{64}$/);
    const detail = JSON.parse(await readFile(new URL(`../public/api/entries/${item.id}.json`, import.meta.url), "utf8"));
    assert.equal(detail.install.automatic, false);
    assert.equal(detail.sha256, item.sha256);
  }
  const imported = catalog.items.find((item) => item.registry === "mcp-official");
  assert.ok(imported);
  const detail = JSON.parse(await readFile(new URL(`../public/api/entries/${imported.id}.json`, import.meta.url), "utf8"));
  assert.equal(detail.install.automatic, false);
  assert.equal(detail.verification, "namespace-verified");
  assert.ok(detail.risk.includes("not-security-audited"));
  const featuredWind = catalog.items.filter((item) => item.registry === "wind-aifin" && item.badges?.includes("精选"));
  assert.equal(featuredWind.filter((item) => item.type === "skill").length, 10);
  assert.equal(featuredWind.filter((item) => item.type === "mcp").length, 7);
  assert.ok(featuredWind.every((item) => item.tags.includes("精选")));
  assert.ok(catalog.items.some((item) => item.upstreamId === "wind-find-finance-skill" && item.badges.includes("官方") && item.badges.includes("精选")));
  assert.ok(catalog.items.some((item) => item.upstreamId === "earnings-analysis" && item.badges.includes("精选") && !item.badges.includes("官方")));
});
