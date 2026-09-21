import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const MODULE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

// The regex covers every way a file can pull the package. A `from` clause
// matches named, default, namespace, and `import type` imports. Bare
// `import "..."`, dynamic `import("...")`, and `require("...")` match
// the other two alternatives. The ban covers the whole SDK outside
// infrastructure/trigger, not only `streams`.
const SDK_REF =
	/(?:\bfrom|\bimport|\brequire)\s*\(?\s*["']@trigger\.dev\/sdk(?:\/[^"']*)?["']/;

function* tsFiles(dir: string): Generator<string> {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) {
			yield* tsFiles(path);
		} else if (entry.name.endsWith(".ts")) {
			yield path;
		}
	}
}

describe("Trigger stream isolation", () => {
	it("only infrastructure/trigger may reference the Trigger SDK", () => {
		const offenders: string[] = [];

		for (const file of tsFiles(MODULE_ROOT)) {
			// The allowed directory itself is skipped — spec files inside it
			// are covered too (this file's own pattern text is a regex here,
			// never an import statement, so it cannot match itself).
			if (file.includes(`${join("infrastructure", "trigger")}`)) {
				continue;
			}

			const source = readFileSync(file, "utf8");
			if (SDK_REF.test(source)) {
				offenders.push(relative(MODULE_ROOT, file));
			}
		}

		expect(offenders).toEqual([]);
	});
});
