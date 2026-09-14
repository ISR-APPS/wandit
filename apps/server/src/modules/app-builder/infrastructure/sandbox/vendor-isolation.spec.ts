import { readdir, readFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// The folder that may mention the vendor: this spec's own directory.
const SANDBOX_DIR = dirname(fileURLToPath(import.meta.url));
// `apps/server/src` — four levels above the sandbox folder.
const SRC_DIR = join(SANDBOX_DIR, "../../../..");
const ALLOWED_PREFIX = relative(SRC_DIR, SANDBOX_DIR);

const FORBIDDEN = [
	"@vercel/sandbox",
	"@ai-sdk/sandbox-vercel",
	"sandbox.vercel.app",
	".vercel.run",
];

/**
 * `harness-packages.spec.ts` (WANDIT-148) predates this rule; it imports the
 * vendor package only to pin that it exists, and calls none of it.
 */
const EXEMPT = new Set(["modules/ai-chat/agent/harness-packages.spec.ts"]);

async function* sourceFiles(dir: string): AsyncGenerator<string> {
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) {
			yield* sourceFiles(path);
		} else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
			yield path;
		}
	}
}

describe("vendor isolation", () => {
	it("keeps Vercel sandbox names inside the sandbox folder", async () => {
		const violations: string[] = [];
		for await (const path of sourceFiles(SRC_DIR)) {
			const rel = relative(SRC_DIR, path);
			if (
				rel === "" ||
				rel.startsWith(`${ALLOWED_PREFIX}/`) ||
				EXEMPT.has(rel)
			) {
				continue;
			}
			const content = await readFile(path, "utf8");
			for (const marker of FORBIDDEN) {
				if (content.includes(marker)) {
					violations.push(`${rel} mentions ${marker}`);
				}
			}
		}
		expect(violations).toEqual([]);
	});
});
