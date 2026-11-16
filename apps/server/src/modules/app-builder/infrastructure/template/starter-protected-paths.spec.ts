import { spawnSync } from "node:child_process";
import {
	cpSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const scriptsDir = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../../../../../../../templates/starters/scripts",
);

const tempRoots: string[] = [];

afterEach(() => {
	for (const root of tempRoots.splice(0)) {
		rmSync(root, { recursive: true, force: true });
	}
});

/**
 * Builds a templates folder with the real starter scripts, a base template that holds one kit file,
 * and the starter "demo". Then it runs pack.mjs there. The scripts find the folders from their own path.
 */
function packDemoStarter(input: {
	/** A path that the starter adds to files/, relative to the project root. */
	file?: string;
	/** One entry of the "removed" list of starter.json. */
	removed?: string;
	/** A path below the starter folder. A symlink to a copy of the valid files/ takes its place. */
	link?: string;
}) {
	const root = mkdtempSync(join(tmpdir(), "starter-guard-"));
	tempRoots.push(root);
	const templatesDir = join(root, "templates");
	cpSync(scriptsDir, join(templatesDir, "starters", "scripts"), {
		recursive: true,
	});
	const kitDir = join(templatesDir, "web-app", "src", "shared", "ui");
	mkdirSync(kitDir, { recursive: true });
	writeFileSync(join(kitDir, "button.tsx"), "export {};\n");

	const starterDir = join(templatesDir, "starters", "demo");
	// STARTER.md and the host theme are allowed and required, so only the row input decides the result.
	const files = [
		{ path: "STARTER.md", text: "x\n" },
		{ path: "src/styles/theme.json", text: '{"origin":"host"}\n' },
		...(input.file ? [{ path: input.file, text: "x\n" }] : []),
	];
	for (const { path, text } of files) {
		mkdirSync(dirname(join(starterDir, "files", path)), { recursive: true });
		writeFileSync(join(starterDir, "files", path), text);
	}
	if (input.link) {
		const linkPath = join(starterDir, input.link);
		const linkTarget = join(root, "link-target");
		// The target is a valid overlay, so only the link itself can be the reason for a refusal.
		cpSync(join(starterDir, "files"), linkTarget, { recursive: true });
		rmSync(linkPath, { recursive: true, force: true });
		mkdirSync(dirname(linkPath), { recursive: true });
		symlinkSync(linkTarget, linkPath);
	}
	writeFileSync(
		join(starterDir, "starter.json"),
		JSON.stringify({
			id: "demo",
			removed: input.removed ? [input.removed] : [],
		}),
	);
	const result = spawnSync(
		process.execPath,
		[join(templatesDir, "starters", "scripts", "pack.mjs")],
		{ encoding: "utf8" },
	);
	return {
		...result,
		hasArchive: existsSync(join(templatesDir, "starter-demo.tar.gz")),
	};
}

describe("templates/starters/scripts: protected paths", () => {
	it.each([
		// The agent rules and the sandbox hook protect the user. A starter must not replace them.
		{ file: "CLAUDE.md", refused: true },
		{ file: ".claude/hooks/pre-tool-use.mjs", refused: true },
		// macOS ignores case, so this name replaces CLAUDE.md in a work folder.
		{ file: "claude.md", refused: true },
		{ file: ".git/hooks/pre-commit", refused: true },
		{ file: ".env.local", refused: true },
		{ file: "src/shared/i18n/translate.ts", refused: true },
		{ file: "src/shared/i18n/messages.ts", refused: false },
		// button.tsx exists in the base template. rating.tsx is a new kit file.
		{ file: "src/shared/ui/button.tsx", refused: true },
		{ file: "src/shared/ui/rating.tsx", refused: false },
		{ removed: "src/shared/lib/supabase.ts", refused: true },
		// A folder that holds protected files.
		{ removed: "src", refused: true },
		{ removed: "src/features/landing/../../../CLAUDE.md", refused: true },
		{ removed: "/etc/passwd", refused: true },
		{ removed: "src\\router.tsx", refused: true },
		{ removed: "src/features/landing/components/hero.tsx", refused: false },
	])("pack.mjs with %o", ({ refused, ...input }) => {
		const result = packDemoStarter(input);

		if (refused) {
			expect(result.status).toBe(1);
			expect(result.stderr).toContain(`  ${input.file ?? input.removed}: `);
			expect(result.hasArchive).toBe(false);
		} else {
			expect(result.stderr).toBe("");
			expect(result.status).toBe(0);
			expect(result.hasArchive).toBe(true);
		}
	});

	// tar packs a link as a link. The server apply step then copies the target of the link in the sandbox.
	it.each([
		{ link: "files/public/host", reason: "is not a regular file" },
		{ link: "files", reason: "is a link" },
	])("pack.mjs refuses a symlink at $link", ({ link, reason }) => {
		const result = packDemoStarter({ link });

		expect(result.status).toBe(1);
		expect(result.stderr).toContain(reason);
		expect(result.hasArchive).toBe(false);
	});
});
