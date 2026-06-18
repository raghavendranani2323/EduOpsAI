import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

const root = ".next/static/chunks";
let largest = { file: "", bytes: 0 };
let total = 0;

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (entry.name.endsWith(".js")) {
      const bytes = (await stat(path)).size;
      total += bytes;
      if (bytes > largest.bytes) largest = { file: path, bytes };
    }
  }
}

await walk(root);
const maxChunk = 400 * 1024;
const maxTotal = 4 * 1024 * 1024;
if (largest.bytes > maxChunk) throw new Error(`Largest client chunk exceeds 400 KiB: ${largest.file} (${largest.bytes})`);
if (total > maxTotal) throw new Error(`Client chunks exceed 4 MiB raw total: ${total}`);
console.log(`Performance budget passed. Largest=${largest.bytes} bytes; total=${total} bytes.`);
