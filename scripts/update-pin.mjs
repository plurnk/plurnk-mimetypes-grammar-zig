#!/usr/bin/env node
// Advances the source pin under {§grammar-leaf-reproducibility}.
import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const check = process.argv.includes("--check");
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pinPath = path.join(repoRoot, ".grammar-pin");

const source = (await readFile(path.join(repoRoot, ".grammar-source"), "utf-8")).trim();
const pin = (await readFile(pinPath, "utf-8")).trim();
if (!/^[0-9a-f]{40}$/i.test(pin)) {
    throw new Error(`.grammar-pin must be a full git commit SHA, got: ${pin}`);
}

// `git ls-remote --tags` lists both `refs/tags/<t>` and (for annotated tags)
// `refs/tags/<t>^{}` (the dereferenced commit). Prefer the deref — that's the
// commit `git checkout <tag>` lands on, i.e. what .grammar-pin must hold.
const raw = execFileSync("git", ["ls-remote", "--tags", source], { encoding: "utf-8" });
const tagToSha = new Map();
for (const line of raw.trim().split("\n")) {
    if (!line) continue;
    const [sha, ref] = line.split("\t");
    const m = /^refs\/tags\/(.+?)(\^\{\})?$/.exec(ref ?? "");
    if (!m) continue;
    const [, tag, deref] = m;
    if (deref || !tagToSha.has(tag)) tagToSha.set(tag, sha);
}

const releases = [...tagToSha.keys()]
    .map((t) => ({ tag: t, parts: /^v?(\d+)\.(\d+)\.(\d+)$/.exec(t) }))
    .filter((r) => r.parts !== null)
    .map((r) => ({ tag: r.tag, v: [Number(r.parts[1]), Number(r.parts[2]), Number(r.parts[3])] }))
    .sort((a, b) => a.v[0] - b.v[0] || a.v[1] - b.v[1] || a.v[2] - b.v[2]);

if (releases.length === 0) {
    console.log(`${source}: no stable release tags upstream — staying pinned at ${pin.slice(0, 12)}`);
    process.exit(0);
}

const latest = releases[releases.length - 1];
const latestSha = tagToSha.get(latest.tag);
if (latestSha === pin) {
    console.log(`up to date: ${latest.tag} (${pin.slice(0, 12)})`);
    process.exit(0);
}

console.log(`BUMP ${pin.slice(0, 12)} -> ${latestSha.slice(0, 12)} (${latest.tag})`);
if (!check) {
    await writeFile(pinPath, `${latestSha}\n`);
    console.log(`wrote .grammar-pin`);
}
