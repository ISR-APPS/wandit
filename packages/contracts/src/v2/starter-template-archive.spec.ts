import { describe, expect, it } from "vitest";

import { starterTemplateManifestSchema } from "./starter-template-archive";

describe("starterTemplateManifestSchema", () => {
	// The apply task gives each removed path to `rm -rf` in the project sandbox.
	it.each([
		["a file in a folder", "src/routes/index.tsx", true],
		[
			"a route file with $ and brackets",
			"src/routes/app.$id.[.]json.tsx",
			true,
		],
		["a folder with parentheses", "src/routes/(marketing)/about.tsx", true],
		["a dot file", "public/.well-known", true],
		["a parent segment at the start", "../web-app/package.json", false],
		["a parent segment in the middle", "src/../../etc/passwd", false],
		["a parent segment at the end", "src/..", false],
		["a current-folder segment", "./src", false],
		["a leading slash", "/etc/passwd", false],
		["an empty segment", "src//routes", false],
		["a last slash", "src/", false],
		["a backslash", "src\\routes", false],
		["a NUL character", "src/a\u0000b", false],
		["a line break after a good path", "src/a.ts\n", false],
		["a space", "src/my file.ts", false],
		["the git folder", ".git", false],
		["a file of the git folder", ".git/config", false],
		["no character", "", false],
	])("checks a removed path with %s", (_label, path, isAccepted) => {
		const parsed = starterTemplateManifestSchema.safeParse({
			id: "crm-pro",
			removed: [path],
		});

		expect(parsed.success).toBe(isAccepted);
	});
});
