// Packs the template into mobile-app-<version>.tar.gz next to this folder.
// The host runs it when a new template version ships.
// node_modules, build output, and env files never enter the archive.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// The version lives in template_version so the pack name matches the marker.
// The server reads line 1 and splits it on "@".
const versionLine = readFileSync(join(root, "template_version"), "utf8")
	.split("\n")[0]
	.trim();
const [name, version] = versionLine.split("@");
if (name !== "mobile-app" || !version) {
	throw new Error("template_version line 1 must be mobile-app@<version>");
}

const outPath = join(root, "..", `mobile-app-${version}.tar.gz`);

execFileSync(
	"tar",
	[
		"-czf",
		outPath,
		"-C",
		root,
		"--exclude=node_modules",
		"--exclude=dist",
		"--exclude=.expo",
		"--exclude=*.tar.gz",
		// macOS tar adds "._*" resource-fork files; the sandbox must not get them.
		"--exclude=._*",
		// A local env file holds secrets and must never enter the archive.
		"--exclude=.env",
		"--exclude=.env.*",
		".",
	],
	// COPYFILE_DISABLE stops macOS tar from adding "._*" resource-fork entries.
	{ env: { ...process.env, COPYFILE_DISABLE: "1" }, stdio: "inherit" },
);

console.log(`wrote ${outPath}`);
