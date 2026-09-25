// Packs every app template: runs <folder>/scripts/pack.mjs for each folder of
// templates/ that has one, in name order. The server `build` script and the
// Trigger deploy workflow call it. It skips a folder without a pack script and
// logs one line. So a template that is not in git yet never breaks a build.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const templatesDir = dirname(fileURLToPath(import.meta.url));

// Sorted, so every build packs in the same order and prints the same log.
const folders = readdirSync(templatesDir, { withFileTypes: true })
	.filter((entry) => entry.isDirectory())
	.map((entry) => entry.name)
	.sort();

let failures = 0;
for (const folder of folders) {
	const packScript = join(templatesDir, folder, "scripts", "pack.mjs");
	if (!existsSync(packScript)) {
		console.log(`skip templates/${folder}: no scripts/pack.mjs`);
		continue;
	}
	const result = spawnSync(process.execPath, [packScript], {
		stdio: "inherit",
	});
	if (result.status !== 0) {
		console.error(
			`pack failed: templates/${folder}/scripts/pack.mjs (${result.error?.message ?? `exit ${result.status ?? result.signal}`})`,
		);
		failures += 1;
	}
}

// A deploy without an archive fails the first turn of that platform, so a
// failed pack must fail the build.
if (failures > 0) {
	process.exit(1);
}
