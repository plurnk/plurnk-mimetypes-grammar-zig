#!/usr/bin/env node
// Reproducible WASM build for tree-sitter-zig.
import { mkdtempDisposable, readFile, copyFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = (await readFile(path.join(repoRoot, ".grammar-source"), "utf-8")).trim();
const pin = (await readFile(path.join(repoRoot, ".grammar-pin"), "utf-8")).trim();
if (!/^[0-9a-f]{40}$/i.test(pin)) {
    throw new Error(`.grammar-pin must be a full git commit SHA, got: ${pin}`);
}

await using temporary = await mkdtempDisposable(path.join(tmpdir(), "grammar-zig-build-"));
const work = temporary.path;
await run("git", ["init", "--quiet", "src"], { cwd: work });
await run("git", ["fetch", "--quiet", "--depth=1", source, pin], { cwd: path.join(work, "src") });
await run("git", ["checkout", "--quiet", "--detach", "FETCH_HEAD"], { cwd: path.join(work, "src") });

const cli = path.join(repoRoot, "node_modules", ".bin", "tree-sitter");
const buildCwd = path.join(work, "src");
await run(cli, ["generate"], { cwd: buildCwd });
await run(cli, ["build", "--wasm"], { cwd: buildCwd });

// Locate produced wasm and copy as zig.wasm.
const fs = await import("node:fs/promises");
const built = (await fs.readdir(buildCwd)).find((f) => f.endsWith(".wasm"));
if (!built) throw new Error("no .wasm produced");
await copyFile(path.join(buildCwd, built), path.join(repoRoot, "zig.wasm"));
const bytes = (await readFile(path.join(repoRoot, "zig.wasm"))).length;
console.log(`zig.wasm: ${bytes} bytes (built from ${pin})`);

function run(cmd, args, opts) {
    return new Promise((resolve, reject) => {
        const child = spawn(cmd, args, { stdio: "inherit", ...opts });
        child.on("error", reject);
        child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`)));
    });
}
