import { syntaxTree } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import {
	Database,
	File,
	FileBraces,
	FileCode,
	FileCog,
	FileImage,
	FileLock,
	FileSliders,
	FileTerminal,
	FileText,
	FileType,
} from "lucide-react";
import { describe, expect, it } from "vitest";

import {
	codeLanguageFor,
	countLines,
	fileIconFor,
	fileNameOf,
	isProsePath,
} from "./code-files";

describe("codeLanguageFor", () => {
	it.each([
		["src/routes/index.tsx", "TSX"],
		["src/db/schema.ts", "TypeScript"],
		["src/worker.mts", "TypeScript"],
		["src/legacy.cts", "TypeScript"],
		["src/button.jsx", "JSX"],
		["scripts/build.js", "JavaScript"],
		["eslint.config.mjs", "JavaScript"],
		["babel.config.cjs", "JavaScript"],
		["package.json", "JSON"],
		["wrangler.jsonc", "JSON with Comments"],
		["src/styles.css", "CSS"],
		["index.html", "HTML"],
		["README.md", "Markdown"],
		["docs/page.mdx", "Markdown"],
		["pnpm-workspace.yaml", "YAML"],
		[".github/workflows/ci.yml", "YAML"],
		["migrations/0001_init.sql", "SQL"],
		["public/favicon.svg", "SVG"],
		["public/sitemap.xml", "XML"],
		["src/APP.TSX", "TSX"],
	])("maps %s to %s", (path, label) => {
		expect(codeLanguageFor(path)?.label).toBe(label);
	});

	it.each([
		".gitignore",
		".npmrc",
		"template_version",
		"src/.env.example",
		"notes.txt",
	])("answers null for the plain text file %s", (path) => {
		expect(codeLanguageFor(path)).toBeNull();
	});

	it("loads a grammar that CodeMirror can use", async () => {
		const support = await codeLanguageFor("src/app.tsx")?.load();
		expect(support?.language.name).toBe("typescript");
	});

	it("reads the YAML front matter of a Markdown file as YAML", async () => {
		const support = await codeLanguageFor("SKILL.md")?.load();
		const state = EditorState.create({
			doc: '---\nname: "forge"\n---\n# Title\n',
			extensions: support ? [support] : [],
		});
		const names: string[] = [];
		syntaxTree(state).iterate({ enter: (node) => void names.push(node.name) });
		expect(names).toContain("Frontmatter");
		expect(names).not.toContain("SetextHeading2");
		expect(names).toContain("ATXHeading1");
	});
});

describe("isProsePath", () => {
	it.each([
		["README.md", true],
		["docs/page.MDX", true],
		["notes.txt", true],
		["src/app.tsx", false],
		[".md", false],
	])("answers %s -> %s", (path, isProse) => {
		expect(isProsePath(path)).toBe(isProse);
	});
});

describe("fileIconFor", () => {
	it.each([
		["pnpm-lock.yaml", FileLock],
		["bun.lockb", FileLock],
		[".gitignore", FileCog],
		["biome.json", FileCog],
		["vite.config.ts", FileCog],
		["tsconfig.json", FileCog],
		["tsconfig.app.json", FileCog],
		["index.tsx", FileCode],
		["schema.ts", FileCode],
		["build.mjs", FileCode],
		["styles.css", FileCode],
		["package.json", FileBraces],
		["SKILL.md", FileText],
		["0001_init.sql", Database],
		["pnpm-workspace.yaml", FileSliders],
		["logo.PNG", FileImage],
		["inter.woff2", FileType],
		["deploy.sh", FileTerminal],
		["template_version", File],
		["LICENSE", File],
	])("gives %s its icon", (name, Icon) => {
		expect(fileIconFor(name).Icon).toBe(Icon);
	});

	it("colors code by type and keeps prose and configs muted", () => {
		expect(fileIconFor("index.tsx").colorClass).toBe("text-(--code-type)");
		expect(fileIconFor("schema.ts").colorClass).toBe("text-(--code-function)");
		expect(fileIconFor("SKILL.md").colorClass).toBe("text-muted-foreground");
		expect(fileIconFor("vite.config.ts").colorClass).toBe(
			"text-muted-foreground",
		);
	});
});

describe("fileNameOf", () => {
	it("answers the last segment of a path", () => {
		expect(fileNameOf("src/routes/index.tsx")).toBe("index.tsx");
		expect(fileNameOf("package.json")).toBe("package.json");
	});
});

describe("countLines", () => {
	it.each([
		["", 0],
		["one", 1],
		["one\n", 1],
		["one\ntwo", 2],
		["one\ntwo\n", 2],
		["\n", 1],
		["one\n\nthree\n", 3],
	])("counts %j as %i lines", (content, lines) => {
		expect(countLines(content)).toBe(lines);
	});
});
