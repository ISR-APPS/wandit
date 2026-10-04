// The web template has no test runner, so this spec runs its Vite plugin
// (templates/web-app/vite-plugins/wandit-source.ts) with the Vite of apps/web.

import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build, createServer, type InlineConfig } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { wanditSource } from "../../../../../../templates/web-app/vite-plugins/wandit-source";

// Arabic text before the JSX: a byte offset instead of a UTF-16 offset
// would put the attribute and the column in the wrong place.
const APP_SOURCE = [
	'const Fragment = "fragment";',
	'const List = "list";',
	// It returns its input, so the build keeps the JSX calls.
	"function h(...input) { return input; }",
	"export function App() {",
	'\tconst title = "مرحبا بكم";',
	"\treturn (",
	"\t\t<main>",
	"\t\t\t<Fragment>{title}</Fragment>",
	"\t\t\t<List<string> items={[title]} />",
	'\t\t\t<button type="button">Order now</button>',
	"\t\t</main>",
	"\t);",
	"}",
].join("\n");

let root: string;
// Classic JSX with the local `h`: the fixture imports no React to resolve.
let baseConfig: InlineConfig;

beforeAll(async () => {
	// The real path: on macOS the temp folder is a symlink, and Vite resolves ids to real paths.
	root = await realpath(await mkdtemp(join(tmpdir(), "wandit-source-")));
	await mkdir(join(root, "src"));
	await writeFile(join(root, "src/app.tsx"), APP_SOURCE);
	baseConfig = {
		root,
		configFile: false,
		logLevel: "silent",
		plugins: [wanditSource()],
		oxc: { jsx: { runtime: "classic", pragma: "h", pragmaFrag: "Fragment" } },
	};
});

afterAll(async () => {
	await rm(root, { recursive: true, force: true });
});

describe("wanditSource", () => {
	it("adds file:line:col after the tag and its type arguments in vite dev, but not to a Fragment", async () => {
		const server = await createServer({
			...baseConfig,
			server: { middlewareMode: true, ws: false },
		});
		try {
			const code = (await server.transformRequest("/src/app.tsx"))?.code ?? "";

			expect(code).toContain("src/app.tsx:7:3");
			expect(code).toContain("src/app.tsx:9:4");
			expect(code).toContain("src/app.tsx:10:4");
			expect(code.match(/data-wandit-src/g)).toHaveLength(3);
		} finally {
			await server.close();
		}
	});

	it("adds nothing in vite build", async () => {
		const result = await build({
			...baseConfig,
			build: {
				write: false,
				lib: { entry: join(root, "src/app.tsx"), formats: ["es"] },
			},
		});
		// Without `build.watch` the result holds outputs only, never a watcher.
		const code = [result]
			.flat()
			.flatMap((output) => ("output" in output ? output.output : []))
			.map((file) => (file.type === "chunk" ? file.code : ""))
			.join("\n");

		expect(code).toContain("Order now");
		expect(code).not.toContain("data-wandit-src");
	});
});
