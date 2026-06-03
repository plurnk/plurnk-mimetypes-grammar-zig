#!/usr/bin/env node
// CI byte-identical reproducibility check for zig.wasm.
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pin = (await readFile(path.join(repoRoot, ".grammar-pin"), "utf-8")).trim();
const committed = await readFile(path.join(repoRoot, "zig.wasm"));
const committedHash = createHash("sha256").update(committed).digest("hex");
console.log(`committed zig.wasm sha256: ${committedHash}`);

const work = await mkdtemp(path.join(tmpdir(), "grammar-zig-verify-"));
await run("git", ["clone", "--no-checkout", "https://github.com/tree-sitter-grammars/tree-sitter-zig.git", "src"], { cwd: work });
await run("git", ["checkout", pin], { cwd: path.join(work, "src") });
await run("npm", ["install", "--no-save", "tree-sitter-cli@^0.26.0"], { cwd: work });
const cli = path.join(work, "node_modules", ".bin", "tree-sitter");
const buildCwd = path.join(work, "src");
await run(cli, ["generate"], { cwd: buildCwd });
await run(cli, ["build", "--wasm"], { cwd: buildCwd });
const fs = await import("node:fs/promises");
const built = (await fs.readdir(buildCwd)).find((f) => f.endsWith(".wasm"));
const rebuiltHash = createHash("sha256").update(await readFile(path.join(buildCwd, built))).digest("hex");
console.log(`rebuilt zig.wasm sha256: ${rebuiltHash}`);
if (committedHash !== rebuiltHash) {
    console.error("FAIL: bytes differ");
    process.exit(1);
}
console.log("OK: bytes identical");

function run(cmd, args, opts) {
    return new Promise((resolve, reject) => {
        const child = spawn(cmd, args, { stdio: "inherit", ...opts });
        child.on("error", reject);
        child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`)));
    });
}
