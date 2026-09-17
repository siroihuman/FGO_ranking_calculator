import { mkdir, readFile } from "node:fs/promises";
import { build } from "esbuild";

async function readJsonOr<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return fallback;
  }
}

const servants = await readJsonOr<unknown[]>("data/servants.status.json", []);
const metadata = await readJsonOr<Record<string, unknown>>(
  "data/status-metadata.json",
  {
    generatedAt: null,
    discoveredLinks: servants.length,
    parsedRecords: servants.length,
    errors: 0,
  },
);

await mkdir("dist", { recursive: true });
await build({
  entryPoints: ["src/browser/entry.ts"],
  outfile: "dist/ranking.bundle.js",
  bundle: true,
  platform: "browser",
  format: "iife",
  target: ["es2020"],
  minify: true,
  legalComments: "none",
  define: {
    __FGO_RANKING_DATA__: JSON.stringify(servants),
    __FGO_RANKING_META__: JSON.stringify(metadata),
  },
});

console.log(`browser bundle: ${servants.length} servant records embedded`);
