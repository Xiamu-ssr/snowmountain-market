import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildCatalog } from "../scripts/build-catalog.mjs";

test("builds a deterministic catalog with valid artifact hashes", async () => {
  const catalog = await buildCatalog();
  assert.equal(catalog.format, "snowmountain-market-catalog/v1");
  assert.equal(catalog.items.length, 4);
  assert.deepEqual(catalog.items.map((item) => item.id), [
    "evidence-verifier",
    "filesystem-readonly-mcp",
    "workspace-researcher",
    "sandbox-probe"
  ]);
  for (const item of catalog.items) {
    assert.match(item.sha256, /^[0-9a-f]{64}$/);
    const detail = JSON.parse(await readFile(new URL(`../public/api/entries/${item.id}.json`, import.meta.url), "utf8"));
    assert.equal(detail.install.automatic, false);
    assert.equal(detail.sha256, item.sha256);
  }
});
