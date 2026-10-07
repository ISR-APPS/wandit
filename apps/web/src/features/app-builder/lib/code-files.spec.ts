import { ensureSyntaxTree } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { BracketsCurlyIcon } from "@phosphor-icons/react/BracketsCurly";
import { FileImageIcon } from "@phosphor-icons/react/FileImage";
import { FileTextIcon } from "@phosphor-icons/react/FileText";
import { FileTsIcon } from "@phosphor-icons/react/FileTs";
import { GearSixIcon } from "@phosphor-icons/react/GearSix";
import { LockSimpleIcon } from "@phosphor-icons/react/LockSimple";
import { describe, expect, it } from "vitest";

import {
	codeLanguageFor,
	countLines,
	fileIconFor,
	isProsePath,
} from "./code-files";

describe("codeLanguageFor", () => {
	it.each([
		["src/APP.TSX", "TSX"],
		// A dot in a folder name is not the extension.
		[".github/workflows/ci.yml", "YAML"],
	])("maps %s to %s", (path, label) => {
		expect(codeLanguageFor(path)?.label).toBe(label);
	});

	it.each([
		".gitignore",
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
		// The first parse stops after 20 ms. A slow CI runner then gives a partial tree.
		const tree = ensureSyntaxTree(state, state.doc.length, 5_000);
		expect(tree).not.toBeNull();
		const names: string[] = [];
		tree?.iterate({ enter: (node) => void names.push(node.name) });
		expect(names).toContain("Frontmatter");
		expect(names).not.toContain("SetextHeading2");
		expect(names).toContain("ATXHeading1");
	});
});

describe("isProsePath", () => {
	it.each([
		["docs/page.MDX", true],
		["src/app.tsx", false],
		[".md", false],
	])("answers %s -> %s", (path, isProse) => {
		expect(isProsePath(path)).toBe(isProse);
	});
});

describe("fileIconFor", () => {
	// Full-name rules win over the extension; case and a leading dot do not change the answer.
	it.each([
		["pnpm-lock.yaml", LockSimpleIcon],
		[".gitignore", GearSixIcon],
		["biome.json", GearSixIcon],
		["vite.config.ts", GearSixIcon],
		["tsconfig.app.json", GearSixIcon],
		["schema.ts", FileTsIcon],
		["package.json", BracketsCurlyIcon],
		["logo.PNG", FileImageIcon],
		["template_version", FileTextIcon],
	])("gives %s its icon", (name, Icon) => {
		expect(fileIconFor(name).Icon).toBe(Icon);
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
