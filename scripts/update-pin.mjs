#!/usr/bin/env node
// Advance .grammar-pin to the upstream grammar's latest stable release tag.
//
// Self-discovers everything from the repo, so this script is byte-identical
// across every @plurnk/plurnk-mimetypes-grammar-* package:
//   - the upstream repo URL is read from scripts/build-wasm.mjs (the clone line)
//   - the current pin is read from .grammar-pin
//
// It resolves the highest semver release TAG upstream (never bare HEAD — a tag
// is a deliberate release), maps it to its commit SHA, and if that differs from
// the pin, rewrites .grammar-pin. The caller (the update-grammar workflow) then
// rebuilds the WASM and opens a PR; publishing stays a manual, human-gated step.
//
// Usage: node scripts/update-pin.mjs [--check]
//   --check  print the decision without writing .grammar-pin (CI dry-run / local)
//
// Exit 0 always (no upstream tags, or already current, are normal outcomes —
// not failures). Prints "BUMP <old> -> <new> (<tag>)" on a real advance so the
// workflow can branch on it.
import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const check = process.argv.includes("--check");
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pinPath = path.join(repoRoot, ".grammar-pin");

const pin = (await readFile(pinPath, "utf-8")).trim();
const buildSrc = await readFile(path.join(repoRoot, "scripts", "build-wasm.mjs"), "utf-8");
const urlMatch = /clone"?,?\s*\[[^\]]*?"(https:\/\/github\.com\/[^"]+?\.git)"/s.exec(buildSrc)
    ?? /"(https:\/\/github\.com\/[^"]+?\.git)"/.exec(buildSrc);
if (!urlMatch) throw new Error("could not find upstream clone URL in scripts/build-wasm.mjs");
const url = urlMatch[1];

// `git ls-remote --tags` lists both `refs/tags/<t>` and (for annotated tags)
// `refs/tags/<t>^{}` (the dereferenced commit). Prefer the deref — that's the
// commit `git checkout <tag>` lands on, i.e. what .grammar-pin must hold.
const raw = execFileSync("git", ["ls-remote", "--tags", url], { encoding: "utf-8" });
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
    console.log(`${url}: no stable release tags upstream — staying pinned at ${pin.slice(0, 12)}`);
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
