// Packs each starter into templates/starter-<id>.tar.gz.
// templates/pack-all.mjs runs it in the server build and in the Trigger deploy.
// The archive root holds manifest.json ({ id, removed }) and files/, the overlay tree.
// The server apply step reads that format. The script needs no git, so it also runs with no checkout.
import { execFileSync } from "node:child_process";
import {
	existsSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	listStarterIds,
	readStarter,
	runScript,
	STARTERS_DIR,
	TEMPLATES_DIR,
} from "./starter-source.mjs";

/** True when the theme.json of an overlay exists, is JSON, and has origin "host". `filesDir` is the files/ folder. */
function hasHostTheme(filesDir) {
	const themePath = join(filesDir, "src", "styles", "theme.json");
	if (!existsSync(themePath)) {
		return false;
	}
	try {
		return JSON.parse(readFileSync(themePath, "utf8"))?.origin === "host";
	} catch (error) {
		// A file that is not JSON is not a host theme. The caller tells the author to build it again.
		console.error(`${themePath} is not valid JSON: ${error.message}`);
		return false;
	}
}

await runScript(() => {
	const ids = listStarterIds();
	if (ids.length === 0) {
		console.log("no starter in templates/starters");
		return;
	}
	// tar takes manifest.json from this folder, so starter.json keeps its author keys out of the archive.
	const manifestDir = mkdtempSync(join(tmpdir(), "starter-pack-"));
	try {
		for (const id of ids) {
			// readStarter throws on a protected path and on a bad "removed" path.
			// It is not null here: listStarterIds returns only folders with a starter.json.
			const starter = readStarter(id);
			if (starter.files.length === 0) {
				throw new Error(
					`The starter "${id}" has no file in files/. Run extract.mjs first.`,
				);
			}
			// The first chat turn replaces a theme file with origin "template". Only build-starter-theme.ts writes origin "host".
			if (!hasHostTheme(starter.filesDir)) {
				throw new Error(
					`The starter "${id}" has no host theme. Run build-starter-theme.ts first.`,
				);
			}
			writeFileSync(
				join(manifestDir, "manifest.json"),
				`${JSON.stringify({ id, removed: starter.removed }, null, "\t")}\n`,
			);
			const outPath = join(TEMPLATES_DIR, `starter-${id}.tar.gz`);
			execFileSync(
				"tar",
				[
					"-czf",
					outPath,
					// macOS tar adds "._*" resource-fork files; the sandbox must not get them.
					"--exclude=._*",
					"--exclude=.DS_Store",
					"-C",
					manifestDir,
					"manifest.json",
					"-C",
					join(STARTERS_DIR, id),
					"files",
				],
				// COPYFILE_DISABLE stops macOS tar from adding "._*" resource-fork entries.
				{ env: { ...process.env, COPYFILE_DISABLE: "1" }, stdio: "inherit" },
			);
			console.log(`wrote ${outPath}`);
		}
	} finally {
		rmSync(manifestDir, { recursive: true, force: true });
	}
});
