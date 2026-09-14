// Smoke test for the template. CI and the host run it before shipping a pack.
// It installs frozen deps, typechecks, lints, builds, then inspects dist/.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function run(cmd, args) {
	console.log(`$ ${cmd} ${args.join(" ")}`);
	execFileSync(cmd, args, { cwd: root, stdio: "inherit" });
}

function dirSizeBytes(dir) {
	let total = 0;
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		total += entry.isDirectory() ? dirSizeBytes(path) : statSync(path).size;
	}
	return total;
}

function findFile(dir, predicate) {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) {
			const found = findFile(path, predicate);
			if (found) {
				return found;
			}
		} else if (predicate(entry.name)) {
			return path;
		}
	}
	return undefined;
}

const pnpm = ["-y", "pnpm@11.7.0"];

run("npx", [...pnpm, "install", "--frozen-lockfile"]);
run("npx", [...pnpm, "run", "typecheck"]);
run("npx", [...pnpm, "run", "lint"]);
run("npx", [...pnpm, "run", "build"]);

const dist = join(root, "dist");
const clientDir = join(dist, "client");
const serverDir = join(dist, "server");

// @cloudflare/vite-plugin emits the worker into dist/server and assets into
// dist/client; the generated wrangler.json lives next to the worker entry.
if (!existsSync(join(serverDir, "index.js"))) {
	throw new Error(
		"dist/server/index.js missing — the worker entry was not emitted",
	);
}
if (!existsSync(join(serverDir, "wrangler.json"))) {
	throw new Error(
		"dist/server/wrangler.json missing — the worker config was not emitted",
	);
}
if (!existsSync(join(clientDir, "assets"))) {
	throw new Error(
		"dist/client/assets missing — static assets were not emitted",
	);
}
const prerendered = findFile(clientDir, (name) => name.endsWith(".html"));
if (!prerendered) {
	throw new Error("no prerendered HTML file under dist/client");
}

// The sandbox installs the full dev tree because vite dev, typecheck, and
// lint all need it. The size check measures that same tree here.
// LIMIT: the dev tree is about 490 MB, workerd alone 146 MB. Upgrade: a
// pre-warmed pnpm store in the sandbox image (WANDIT-164).
const nodeModulesSize = dirSizeBytes(join(root, "node_modules"));
const maxBytes = 600 * 1024 * 1024;
if (nodeModulesSize > maxBytes) {
	throw new Error(
		`node_modules is ${(nodeModulesSize / 1024 / 1024).toFixed(0)} MB, over the 600 MB ceiling`,
	);
}

console.log(
	`smoke ok: worker entry dist/server/index.js, assets, ${prerendered} found; ` +
		`node_modules ${(nodeModulesSize / 1024 / 1024).toFixed(0)} MB`,
);
