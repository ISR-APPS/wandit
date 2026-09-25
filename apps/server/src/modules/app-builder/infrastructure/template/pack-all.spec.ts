import { spawnSync } from "node:child_process";
import {
	copyFileSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const packAllPath = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../../../../../../../templates/pack-all.mjs",
);

/**
 * Copies pack-all.mjs into a fresh templates folder. Each named template gets
 * a pack script with the given body; `null` makes a folder without one.
 */
function templatesFolder(templates: Record<string, string | null>): string {
	const dir = join(mkdtempSync(join(tmpdir(), "pack-all-")), "templates");
	mkdirSync(dir);
	copyFileSync(packAllPath, join(dir, "pack-all.mjs"));
	for (const [name, packBody] of Object.entries(templates)) {
		mkdirSync(join(dir, name, "scripts"), { recursive: true });
		if (packBody !== null) {
			writeFileSync(join(dir, name, "scripts", "pack.mjs"), packBody);
		}
	}
	return dir;
}

/** A pack script that appends its template name to `<templates>/packed.log`. */
function recordingPack(name: string): string {
	return `import { appendFileSync } from "node:fs";
appendFileSync(new URL("../../packed.log", import.meta.url), "${name}\\n");`;
}

function runPackAll(dir: string) {
	return spawnSync(process.execPath, [join(dir, "pack-all.mjs")], {
		encoding: "utf8",
	});
}

describe("templates/pack-all.mjs", () => {
	it("packs each template in name order and skips a folder without a pack script", () => {
		const dir = templatesFolder({
			"mobile-app": null,
			"web-app": recordingPack("web-app"),
			"api-app": recordingPack("api-app"),
		});

		const result = runPackAll(dir);

		expect(result.status).toBe(0);
		expect(readFileSync(join(dir, "packed.log"), "utf8")).toBe(
			"api-app\nweb-app\n",
		);
		expect(result.stdout).toBe(
			"skip templates/mobile-app: no scripts/pack.mjs\n",
		);
	});

	it("exits 1 and names the template when one pack fails", () => {
		const dir = templatesFolder({
			"mobile-app": "process.exit(3);",
			"web-app": recordingPack("web-app"),
		});

		const result = runPackAll(dir);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain(
			"pack failed: templates/mobile-app/scripts/pack.mjs (exit 3)",
		);
		// The other templates still pack, so the log shows every failure at once.
		expect(readFileSync(join(dir, "packed.log"), "utf8")).toBe("web-app\n");
	});
});
