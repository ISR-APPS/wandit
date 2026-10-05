import { describe, expect, it } from "vitest";

import type { CodeTreeNode } from "../api/dto";
import { routesFromCodeTree } from "./preview-routes";

// The files sit in nested folders, like the code snapshot answer.
function treeOf(filePaths: string[]): CodeTreeNode[] {
	const files: CodeTreeNode[] = filePaths.map((path) => ({
		kind: "file",
		path,
		name: path.split("/").at(-1) ?? path,
	}));
	return [
		{
			kind: "folder",
			path: "src",
			name: "src",
			children: [
				{ kind: "folder", path: "src/routes", name: "routes", children: files },
			],
		},
	];
}

describe("routesFromCodeTree", () => {
	it.each<[string, string[], [path: string, isDynamic: boolean][]]>([
		[
			"index and flat files, root first",
			[
				"src/routes/settings.tsx",
				"src/routes/__root.tsx",
				"src/routes/index.tsx",
			],
			[
				["/", false],
				["/settings", false],
			],
		],
		[
			"a param route and a folder index that repeats a flat file",
			[
				"src/routes/invoices.tsx",
				"src/routes/invoices/index.tsx",
				"src/routes/invoices.$invoiceId.tsx",
			],
			[
				["/invoices", false],
				["/invoices/$invoiceId", true],
			],
		],
		[
			"pathless layouts, groups, and route.tsx",
			[
				"src/routes/_auth.tsx",
				"src/routes/_auth/dashboard.tsx",
				"src/routes/(marketing)/pricing.tsx",
				"src/routes/posts/route.tsx",
			],
			[
				["/dashboard", false],
				["/posts", false],
				["/pricing", false],
			],
		],
		[
			"lazy files, the splat, an un-nested route, and an escaped dot",
			[
				"src/routes/about.lazy.tsx",
				"src/routes/files.$.tsx",
				"src/routes/posts_.$postId.edit.tsx",
				"src/routes/sitemap[.]xml.ts",
			],
			[
				["/about", false],
				["/files/$", true],
				["/posts/$postId/edit", true],
				["/sitemap.xml", false],
			],
		],
		[
			"files that are not page routes",
			[
				"src/routes/-components/card.tsx",
				"src/routes/-helpers.ts",
				"src/routes/about.test.tsx",
				"src/routes/about.spec.ts",
				"src/routes/routeTree.gen.ts",
				"src/routes/styles.css",
				"src/routeTree.gen.ts",
				"src/components/page.tsx",
			],
			[],
		],
	])("lists %s", (_case, filePaths, expected) => {
		expect(
			routesFromCodeTree(treeOf(filePaths)).map((route) => [
				route.path,
				route.isDynamic,
			]),
		).toEqual(expected);
	});
});
