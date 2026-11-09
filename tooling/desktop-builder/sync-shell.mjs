// Copies the trusted Tauri shell into a checkout of the private desktop builder
// repo (tooling/desktop-builder/README.md). An engineer runs it by hand after
// each change of templates/desktop-shell. It writes shell/src-tauri without
// target/ and gen/, plus the fixture files that warm-cache.yml builds.
// Usage: node tooling/desktop-builder/sync-shell.mjs <builder repo checkout>
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const shellSource = join(repoRoot, "templates", "desktop-shell", "src-tauri");

const [checkoutArg] = process.argv.slice(2);
if (checkoutArg === undefined) {
	console.error(
		"Usage: node tooling/desktop-builder/sync-shell.mjs <builder repo checkout>",
	);
	process.exit(1);
}
const builderRepo = resolve(checkoutArg);

// The script deletes <checkout>/shell first, so a wrong path must not pass.
if (!existsSync(join(builderRepo, ".github", "workflows", "build.yml"))) {
	console.error(
		`${builderRepo} has no .github/workflows/build.yml. Copy tooling/desktop-builder/.github there first.`,
	);
	process.exit(1);
}
// CI builds with --locked, and the cache key is the hash of Cargo.lock.
if (!existsSync(join(shellSource, "Cargo.lock"))) {
	console.error(`${join(shellSource, "Cargo.lock")} is missing.`);
	process.exit(1);
}

const shellTarget = join(builderRepo, "shell");
// A full delete, so a file that the shell removed does not stay in the builder repo.
rmSync(shellTarget, { recursive: true, force: true });

// Top-level build output and generated schemas. CI makes them again.
const skippedFolders = new Set(["target", "gen"]);
cpSync(shellSource, join(shellTarget, "src-tauri"), {
	recursive: true,
	filter: (source) => !skippedFolders.has(relative(shellSource, source)),
});

// A minisign public key: base64 of a comment line and of "Ed", an 8-byte key
// id, and a 32-byte Ed25519 key (docs/v2/desktop-apps.md, section 10). All
// bytes are zero: no installer of the warm-up build ships.
const keyLine = Buffer.concat([
	Buffer.from("Ed"),
	Buffer.alloc(8),
	Buffer.alloc(32),
]).toString("base64");
const fixturePubkey = Buffer.from(
	`untrusted comment: minisign public key: 0000000000000000\n${keyLine}\n`,
).toString("base64");

// The keys that the server writes per build (section 3), with fixed fake values.
const fixtureConfig = {
	productName: "Wandit Cache Warmup",
	mainBinaryName: "wandit-cache-warmup",
	version: "1.0.1",
	identifier: "app.wandit.p00000000000000000000000000000000",
	plugins: {
		updater: {
			pubkey: fixturePubkey,
			endpoints: [
				"https://updates.invalid/desktop/00000000-0000-0000-0000-000000000000/latest.json",
			],
		},
	},
};

// The layout of desktop-input.tar.gz (section 9): dist/ and migrations/ next to src-tauri/.
// The config stays out of src-tauri/, so a .gitignore of the shell cannot hide it.
const fixtureFiles = {
	"dist/index.html":
		'<!doctype html>\n<html lang="en">\n<head><meta charset="utf-8"><title>Wandit Cache Warmup</title></head>\n<body><p>Cache warm-up build.</p></body>\n</html>\n',
	"migrations/0001_init.sql":
		"CREATE TABLE app_settings (\n  key TEXT PRIMARY KEY,\n  value TEXT NOT NULL\n);\n",
	"tauri.desktop.json": `${JSON.stringify(fixtureConfig, null, 2)}\n`,
};
for (const [path, content] of Object.entries(fixtureFiles)) {
	const file = join(shellTarget, path);
	mkdirSync(dirname(file), { recursive: true });
	writeFileSync(file, content);
}

console.log(`Copied ${shellSource} to ${join(shellTarget, "src-tauri")}.`);
console.log(
	"Commit shell/ in the builder repo and merge it to main. warm-cache.yml then saves the cache.",
);
