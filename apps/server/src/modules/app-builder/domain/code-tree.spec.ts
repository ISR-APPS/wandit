import { describe, expect, it } from "vitest";

import {
	buildCodeTree,
	isReadableCodePath,
	isWritableCodePath,
	pickDefaultFilePath,
	pickPrefetchPaths,
} from "./code-tree";

describe("isReadableCodePath", () => {
	it.each([
		"src/routes/index.tsx",
		"package.json",
		"src/a..b.ts",
		"src/my file.ts",
		"src/.envrc-notes/readme.md",
	])("accepts %s", (path) => {
		expect(isReadableCodePath(path)).toBe(true);
	});

	it.each([
		["the empty path", ""],
		["an absolute path", "/etc/passwd"],
		["a parent segment", "../x"],
		["a parent segment in the middle", "src/../../x"],
		["a dot segment", "./src/app.tsx"],
		["an empty segment", "src//app.tsx"],
		["a trailing slash", "src/"],
		["a NUL byte", "src/app.tsx\0.png"],
		["a .git segment", ".git/config"],
		["a nested .git segment", "vendor/.git/HEAD"],
		["a .env file", ".env"],
		["a .env.local file", ".env.local"],
		["a nested .env file", "apps/web/.env"],
	])("rejects %s", (_label, path) => {
		expect(isReadableCodePath(path)).toBe(false);
	});
});

describe("isWritableCodePath", () => {
	it.each([
		["a source file", "src/routes/index.tsx", true],
		["a nested readme", "docs/README.md", true],
		// The sandbox file system is case-sensitive: dotenv reads `.env` only.
		["an upper-case .ENV file", "A/.ENV", true],
		[
			"a theme file outside the root styles folder",
			"lib/styles/theme.json",
			true,
		],
		// Only the dot-segment rule refuses these two paths: no other rule matches package.json.
		["a dot segment", "./package.json", false],
		["a parent segment", "src/../package.json", false],
		["a .envrc file", ".envrc", false],
		["a nested .env.local file", "src/.env.local", false],
		["the root CLAUDE.md", "CLAUDE.md", false],
		["a nested CLAUDE.md", "docs/CLAUDE.md", false],
		["a nested AGENTS.md", "packages/ui/AGENTS.md", false],
		["a .claude folder", ".claude/settings.json", false],
		["a nested node_modules folder", "src/node_modules/x.js", false],
		["the root theme.json", "src/styles/theme.json", false],
		["the root template_version", "template_version", false],
		["a backslash", "src\\app.tsx", false],
		["an absolute path", "/workspace/src/app.tsx", false],
		["an empty segment", "src//app.tsx", false],
		["a NUL byte", "src/app.tsx\0", false],
		// Bash `$(dirname)` and `$(basename)` drop a trailing newline, so these paths wrote the protected file.
		["a newline after CLAUDE.md", "CLAUDE.md\n", false],
		["a newline after the .claude folder", ".claude\n/settings.json", false],
		["a newline after the .git folder", ".git\n/config", false],
		["a newline in the root theme path", "src/styles\n/theme.json", false],
		["a carriage return after AGENTS.md", "AGENTS.md\r", false],
		["a tab", "a\tb.ts", false],
		["a DEL character", "src/app.tsx\u007f", false],
	])("%s: %s -> %s", (_label, path, expected) => {
		expect(isWritableCodePath(path)).toBe(expected);
	});
});

describe("buildCodeTree", () => {
	it("nests folders and lists folders first, then files, by name", () => {
		expect(
			buildCodeTree([
				"package.json",
				"src/routes/index.tsx",
				"README.md",
				"src/app.tsx",
				"public/favicon.ico",
			]),
		).toEqual([
			{
				children: [
					{ kind: "file", name: "favicon.ico", path: "public/favicon.ico" },
				],
				kind: "folder",
				name: "public",
				path: "public",
			},
			{
				children: [
					{
						children: [
							{
								kind: "file",
								name: "index.tsx",
								path: "src/routes/index.tsx",
							},
						],
						kind: "folder",
						name: "routes",
						path: "src/routes",
					},
					{ kind: "file", name: "app.tsx", path: "src/app.tsx" },
				],
				kind: "folder",
				name: "src",
				path: "src",
			},
			{ kind: "file", name: "package.json", path: "package.json" },
			{ kind: "file", name: "README.md", path: "README.md" },
		]);
	});

	it("drops duplicates, .env files at any depth, and .git paths", () => {
		expect(
			buildCodeTree([
				"a.ts",
				"a.ts",
				".env",
				"apps/web/.env.local",
				".git/config",
			]),
		).toEqual([{ kind: "file", name: "a.ts", path: "a.ts" }]);
	});

	it("keeps only the folder when a file and a folder share a path", () => {
		expect(buildCodeTree(["a", "a/new.ts"])).toEqual([
			{
				children: [{ kind: "file", name: "new.ts", path: "a/new.ts" }],
				kind: "folder",
				name: "a",
				path: "a",
			},
		]);
	});

	it("answers an empty tree for no paths", () => {
		expect(buildCodeTree([])).toEqual([]);
	});
});

describe("pickDefaultFilePath", () => {
	it("prefers src/routes/index.tsx", () => {
		const tree = buildCodeTree(["src/app.tsx", "src/routes/index.tsx"]);

		expect(pickDefaultFilePath(tree)).toBe("src/routes/index.tsx");
	});

	it("falls back to src/app.tsx", () => {
		const tree = buildCodeTree(["package.json", "src/app.tsx"]);

		expect(pickDefaultFilePath(tree)).toBe("src/app.tsx");
	});

	it("falls back to the first file in display order", () => {
		const tree = buildCodeTree(["package.json", "lib/util.ts"]);

		expect(pickDefaultFilePath(tree)).toBe("lib/util.ts");
	});

	it("answers null for a tree without files", () => {
		expect(pickDefaultFilePath([])).toBeNull();
	});
});

describe("pickPrefetchPaths", () => {
	it("puts src/ first, then the other files, both in display order", () => {
		const tree = buildCodeTree([
			"package.json",
			"public/favicon.svg",
			"src/routes/index.tsx",
			"src/app.tsx",
		]);

		expect(pickPrefetchPaths(tree)).toEqual([
			"src/routes/index.tsx",
			"src/app.tsx",
			"public/favicon.svg",
			"package.json",
		]);
	});

	it("skips the top-level .claude/ folder only", () => {
		const tree = buildCodeTree([
			".claude/skills/forge/SKILL.md",
			"docs/.claude-notes.md",
			"README.md",
		]);

		expect(pickPrefetchPaths(tree)).toEqual([
			"docs/.claude-notes.md",
			"README.md",
		]);
	});

	it("puts the default file first, so the path cap never drops it", () => {
		const components = Array.from(
			{ length: 300 },
			(_, index) => `src/components/c${String(index).padStart(3, "0")}.tsx`,
		);
		const picked = pickPrefetchPaths(
			buildCodeTree([...components, "src/routes/index.tsx"]),
		);

		expect(picked[0]).toBe("src/routes/index.tsx");
		expect(picked).toHaveLength(300);
	});

	it("skips a path longer than 4096 bytes", () => {
		const longPath = `src/${"a".repeat(4_093)}.ts`;
		const tree = buildCodeTree([longPath, "src/app.tsx"]);

		expect(pickPrefetchPaths(tree)).toEqual(["src/app.tsx"]);
	});

	it("keeps at most 300 paths", () => {
		const paths = Array.from(
			{ length: 301 },
			(_, index) => `src/f${String(index).padStart(3, "0")}.ts`,
		);

		const picked = pickPrefetchPaths(buildCodeTree(paths));

		expect(picked).toHaveLength(300);
		expect(picked.at(-1)).toBe("src/f299.ts");
	});
});
