import { readFileSync, writeFileSync, copyFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { resolve, dirname, join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");

// 1. Walk dist/ and rewrite relative imports in .d.ts files to add an
//    explicit .js extension. Node16/NodeNext ESM resolution requires
//    extensions; vite-plugin-dts emits bare specifiers like "../types".
const RELATIVE_IMPORT = /(from\s+['"])(\.\.?\/[^'"\n]+?)(['"])/g;

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function fixSpecifier(fileDir, spec) {
  if (spec.endsWith(".js") || spec.endsWith(".cjs") || spec.endsWith(".json")) return spec;
  const resolved = resolve(fileDir, spec);
  // If the bare specifier resolves to a directory containing an index.d.ts,
  // map it to "<spec>/index.js". Otherwise assume it's a file → append ".js".
  if (existsSync(resolved) && statSync(resolved).isDirectory()) {
    return spec.replace(/\/$/, "") + "/index.js";
  }
  return spec + ".js";
}

for (const file of walk(dist)) {
  if (!file.endsWith(".d.ts")) continue;
  const fileDir = dirname(file);
  const src = readFileSync(file, "utf8");
  const next = src.replace(RELATIVE_IMPORT, (_, pre, spec, post) => `${pre}${fixSpecifier(fileDir, spec)}${post}`);
  if (next !== src) writeFileSync(file, next);
}

// 2. Produce the .d.cts twin for each entry's .d.ts. Required by the
//    "require" condition in package.json exports so attw stops flagging
//    "Masquerading as ESM."
const pairs = [
  ["dist/index.d.ts", "dist/index.d.cts"],
  ["dist/testing/index.d.ts", "dist/testing/index.d.cts"],
];

for (const [from, to] of pairs) {
  const srcPath = resolve(root, from);
  const dstPath = resolve(root, to);
  if (!existsSync(srcPath)) {
    console.error(`[build-cjs-types] missing ${from}; did vite build run?`);
    process.exit(1);
  }
  copyFileSync(srcPath, dstPath);
}
