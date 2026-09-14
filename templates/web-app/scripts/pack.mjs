// Packs the template into web-app-<version>.tar.gz next to this folder.
// The host runs it when a new template version ships.
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
	throw new Error("template_version must start with web-app@<version>");
}

const outName = `web-app-${version}.tar.gz`;
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
		"--exclude=.wrangler",
		"--exclude=*.tar.gz",
		// A local env file holds secrets and must never enter the archive.
		"--exclude=.env",
		"--exclude=.env.*",
		".",
	],
	{ stdio: "inherit" },
);

console.log(`wrote ${outPath}`);
