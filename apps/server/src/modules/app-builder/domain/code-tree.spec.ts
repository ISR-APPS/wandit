import { describe, expect, it } from "vitest";

import {
	buildCodeTree,
	isReadableCodePath,
	pickDefaultFilePath,
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
