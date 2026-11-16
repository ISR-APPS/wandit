// Copies the 2 trusted shells into a checkout of the private desktop builder
// repo (tooling/desktop-builder/README.md). An engineer runs it by hand after
// each change of templates/desktop-shell or templates/desktop-shell-electron.
// It writes shell/src-tauri (Tauri) and shell-electron/shell (Electron), each
// without build output, plus the fixture files that warm-cache.yml builds.
// Usage: node tooling/desktop-builder/sync-shell.mjs <builder repo checkout>
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const shellSource = join(repoRoot, "templates", "desktop-shell", "src-tauri");
const electronSource = join(
	repoRoot,
	"templates",
	"desktop-shell-electron",
	"shell",
);

const [checkoutArg] = process.argv.slice(2);
if (checkoutArg === undefined) {
	console.error(
		"Usage: node tooling/desktop-builder/sync-shell.mjs <builder repo checkout>",
	);
	process.exit(1);
}
const builderRepo = resolve(checkoutArg);

// The script deletes <checkout>/shell and <checkout>/shell-electron first, so a wrong path must not pass.
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
// CI installs with "npm ci", and the cache key is the hash of package-lock.json.
if (!existsSync(join(electronSource, "package-lock.json"))) {
	console.error(`${join(electronSource, "package-lock.json")} is missing.`);
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
// The 2 engines use the same keys: tauri.desktop.json and wandit.desktop.json.
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

const fixtureConfigJson = `${JSON.stringify(fixtureConfig, null, 2)}\n`;
const fixtureIndexHtml =
	'<!doctype html>\n<html lang="en">\n<head><meta charset="utf-8"><title>Wandit Cache Warmup</title></head>\n<body><p>Cache warm-up build.</p></body>\n</html>\n';
const fixtureMigrationSql =
	"CREATE TABLE app_settings (\n  key TEXT PRIMARY KEY,\n  value TEXT NOT NULL\n);\n";

/**
 * Writes fixture files below one folder of the builder repo.
 * @param {string} targetFolder Absolute path of the folder that gets the files.
 * @param {Record<string, string>} files File content by path. Each path is relative to targetFolder.
 */
function writeFixtureFiles(targetFolder, files) {
	for (const [path, content] of Object.entries(files)) {
		const file = join(targetFolder, path);
		mkdirSync(dirname(file), { recursive: true });
		writeFileSync(file, content);
	}
}

// The layout of a Tauri desktop-input.tar.gz (section 9): dist/ and migrations/ next to src-tauri/.
// The config stays out of src-tauri/, so a .gitignore of the shell cannot hide it.
writeFixtureFiles(shellTarget, {
	"dist/index.html": fixtureIndexHtml,
	"migrations/0001_init.sql": fixtureMigrationSql,
	"tauri.desktop.json": fixtureConfigJson,
});

const electronTarget = join(builderRepo, "shell-electron");
// A full delete, so a file that the shell removed does not stay in the builder repo.
rmSync(electronTarget, { recursive: true, force: true });

// Top-level installed packages and build output. CI makes them again.
const skippedElectronFolders = new Set(["node_modules", "release"]);
cpSync(electronSource, join(electronTarget, "shell"), {
	recursive: true,
	filter: (source) =>
		!skippedElectronFolders.has(relative(electronSource, source)),
});

// The layout of an Electron desktop-input.tar.gz: dist/ and migrations/ next to shell/.
// electron-builder.config.cjs reads ./wandit.desktop.json, so this config is in shell/.
writeFixtureFiles(electronTarget, {
	"dist/index.html": fixtureIndexHtml,
	"migrations/0001_init.sql": fixtureMigrationSql,
	"shell/wandit.desktop.json": fixtureConfigJson,
});

console.log(`Copied ${shellSource} to ${join(shellTarget, "src-tauri")}.`);
console.log(`Copied ${electronSource} to ${join(electronTarget, "shell")}.`);
console.log(
	"Commit shell/ and shell-electron/ in the builder repo and merge them to main. warm-cache.yml then saves the caches.",
);
