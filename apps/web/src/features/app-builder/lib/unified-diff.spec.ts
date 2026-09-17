import { describe, expect, it } from "vitest";

import { parseUnifiedDiff } from "./unified-diff";

// A `git show` patch as the API stores it: the commit header, two text
// files, and one binary file.
const PATCH = [
	"commit 8f5c2e1a9b3d4e6f7a8b9c0d1e2f3a4b5c6d7e8f",
	"Author: Wandit <build@wandit.dev>",
	"",
	"    Restore the pass screen",
	"",
	"diff --git a/app/(tabs)/home.tsx b/app/(tabs)/home.tsx",
	"old mode 100644",
	"new mode 100755",
	"index 1111111..2222222 100644",
	"--- a/app/(tabs)/home.tsx",
	"+++ b/app/(tabs)/home.tsx",
	"@@ -1,3 +1,4 @@",
	' import { Screen } from "./screen";',
	'+import { Banner } from "./banner";',
	" ",
	" export function Home() {",
	"diff --git a/app/(tabs)/old.tsx b/app/(tabs)/old.tsx",
	"similarity index 88%",
	"rename from app/(tabs)/stale.tsx",
	"rename to app/(tabs)/old.tsx",
	"index 3333333..4444444 100644",
	"--- a/app/(tabs)/old.tsx",
	"+++ b/app/(tabs)/old.tsx",
	"@@ -1,4 +1,3 @@",
	' import { Screen } from "./screen";',
	'-import { Old } from "./old";',
	" export function Old() {",
	"\\ No newline at end of file",
	"diff --git a/assets/logo.png b/assets/logo.png",
	"index 5555555..6666666 100644",
	"Binary files a/assets/logo.png and b/assets/logo.png differ",
	"",
].join("\n");

describe("parseUnifiedDiff", () => {
	it("parses each file, keeps the hunk headers, and lists a binary file with no lines", () => {
		expect(parseUnifiedDiff(PATCH)).toEqual([
			{
				path: "app/(tabs)/home.tsx",
				lines: [
					{ kind: "context", text: "@@ -1,3 +1,4 @@" },
					{ kind: "context", text: 'import { Screen } from "./screen";' },
					{ kind: "add", text: 'import { Banner } from "./banner";' },
					{ kind: "context", text: "" },
					{ kind: "context", text: "export function Home() {" },
				],
			},
			{
				path: "app/(tabs)/old.tsx",
				lines: [
					{ kind: "context", text: "@@ -1,4 +1,3 @@" },
					{ kind: "context", text: 'import { Screen } from "./screen";' },
					{ kind: "remove", text: 'import { Old } from "./old";' },
					{ kind: "context", text: "export function Old() {" },
				],
			},
			{ path: "assets/logo.png", lines: [] },
		]);
	});

	it("answers an empty list for a patch without files", () => {
		expect(parseUnifiedDiff("commit abc\n\n    no diff\n")).toEqual([]);
	});

	it("skips a file whose path git quoted, so its lines do not land in the file before it", () => {
		// git quotes a path with a non-ASCII character with core.quotePath on.
		const patch = [
			"diff --git a/app/home.tsx b/app/home.tsx",
			"index 1111111..2222222 100644",
			"--- a/app/home.tsx",
			"+++ b/app/home.tsx",
			"@@ -1,1 +1,1 @@",
			"-old",
			"+new",
			'diff --git "a/app/caf\\303\\251.tsx" "b/app/caf\\303\\251.tsx"',
			"index 3333333..4444444 100644",
			'--- "a/app/caf\\303\\251.tsx"',
			'+++ "b/app/caf\\303\\251.tsx"',
			"@@ -1,1 +1,2 @@",
			" export function Cafe() {",
			"+<Banner />",
		].join("\n");

		expect(parseUnifiedDiff(patch)).toEqual([
			{
				path: "app/home.tsx",
				lines: [
					{ kind: "context", text: "@@ -1,1 +1,1 @@" },
					{ kind: "remove", text: "old" },
					{ kind: "add", text: "new" },
				],
			},
		]);
	});
});
