import { mkdir, writeFile } from "node:fs/promises";
import { collectStatusData } from "../src/collectors/statusCollector.js";

function numberOption(name: string): number | undefined {
  const prefix = `--${name}=`;
  const raw = process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  if (!raw) return undefined;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

const perSourceLimit = numberOption("limit");
const concurrency = numberOption("concurrency") ?? 3;

const result = await collectStatusData({
  perSourceLimit,
  concurrency,
});

await mkdir("data", { recursive: true });
await writeFile(
  "data/servants.status.json",
  `${JSON.stringify(result.records, null, 2)}\n`,
  "utf8",
);
await writeFile(
  "data/status-errors.json",
  `${JSON.stringify(result.errors, null, 2)}\n`,
  "utf8",
);
await writeFile(
  "data/status-metadata.json",
  `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    discoveredLinks: result.links.length,
    parsedRecords: result.records.length,
    errors: result.errors.length,
    perSourceLimit: perSourceLimit ?? null,
  }, null, 2)}\n`,
  "utf8",
);

console.log(`discovered: ${result.links.length}`);
console.log(`parsed: ${result.records.length}`);
console.log(`errors: ${result.errors.length}`);
