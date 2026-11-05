// Packs the template into desktop-app-<version>.tar.gz next to this folder.
// templates/pack-all.mjs runs it for the server build and the Trigger deploy.
// node_modules and build output never enter the archive.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// The version lives in template_version so the pack name matches the marker.
const versionLine = readFileSync(join(root, "template_version"), "utf8")
	.split("\n")[0]
	.trim();
const version = versionLine.split("@")[1];
if (!version) {
	throw new Error("template_version must start with desktop-app@<version>");
}

const outName = `desktop-app-${version}.tar.gz`;
const outPath = join(root, "..", outName);

execFileSync(
	"tar",
	[
		"-czf",
		outPath,
		"-C",
		root,
		"--exclude=node_modules",
		"--exclude=dist",
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
