/**
 * File-type rules of the Code view: the CodeMirror language, the tree icon,
 * the line wrap, and the line count of a file. Called by
 * components/code/code-editor.tsx, code-viewer.tsx, and file-tree.tsx.
 * Each grammar is a dynamic import, so it loads as its own lazy chunk.
 */

import type { LanguageSupport } from "@codemirror/language";
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
	type LucideIcon,
} from "lucide-react";

/** A language that the editor colors. */
export type CodeLanguage = {
	/** Name in the status bar, for example "TypeScript". A proper noun, never translated. */
	label: string;
	/** Loads the grammar chunk. The editor keeps the answer for later files. */
	load: () => Promise<LanguageSupport>;
};

/** The icon of a file in the tree and in the breadcrumb. */
export type FileIcon = {
	Icon: LucideIcon;
	/** Tailwind text color class. The code colors are the `--code-*` tokens of index.css. */
	colorClass: string;
};

function javascript(options: { jsx?: boolean; typescript?: boolean }) {
	return () =>
		import("@codemirror/lang-javascript").then((module) =>
			module.javascript(options),
		);
}

const loadJson = () =>
	import("@codemirror/lang-json").then((module) => module.json());
// Agent skills start with a YAML front matter. Plain Markdown reads its
// closing `---` as a heading underline and colors the block as a heading.
const loadMarkdown = () =>
	Promise.all([
		import("@codemirror/lang-yaml"),
		import("@codemirror/lang-markdown"),
	]).then(([yamlModule, markdownModule]) =>
		yamlModule.yamlFrontmatter({ content: markdownModule.markdown() }),
	);
const loadYaml = () =>
	import("@codemirror/lang-yaml").then((module) => module.yaml());
const loadXml = () =>
	import("@codemirror/lang-xml").then((module) => module.xml());

const TYPESCRIPT: CodeLanguage = {
	label: "TypeScript",
	load: javascript({ typescript: true }),
};
const JAVASCRIPT: CodeLanguage = { label: "JavaScript", load: javascript({}) };
const MARKDOWN: CodeLanguage = { label: "Markdown", load: loadMarkdown };
const YAML: CodeLanguage = { label: "YAML", load: loadYaml };

const LANGUAGE_BY_EXTENSION = new Map<string, CodeLanguage>([
	["tsx", { label: "TSX", load: javascript({ jsx: true, typescript: true }) }],
	["ts", TYPESCRIPT],
	["mts", TYPESCRIPT],
	["cts", TYPESCRIPT],
	["jsx", { label: "JSX", load: javascript({ jsx: true }) }],
	["js", JAVASCRIPT],
	["mjs", JAVASCRIPT],
	["cjs", JAVASCRIPT],
	["json", { label: "JSON", load: loadJson }],
	["jsonc", { label: "JSON with Comments", load: loadJson }],
	[
		"css",
		{
			label: "CSS",
			load: () => import("@codemirror/lang-css").then((module) => module.css()),
		},
	],
	[
		"html",
		{
			label: "HTML",
			load: () =>
				import("@codemirror/lang-html").then((module) => module.html()),
		},
	],
	["md", MARKDOWN],
	["mdx", MARKDOWN],
	["yaml", YAML],
	["yml", YAML],
	[
		"sql",
		{
			label: "SQL",
			load: () => import("@codemirror/lang-sql").then((module) => module.sql()),
		},
	],
	["svg", { label: "SVG", load: loadXml }],
	["xml", { label: "XML", load: loadXml }],
]);

/** Prose files wrap their long lines; code scrolls to the side. */
const PROSE_EXTENSIONS = new Set(["md", "mdx", "txt"]);

const MUTED = "text-muted-foreground";

/** Generated lockfiles: large, and never read by hand. */
const LOCKFILE_NAMES = new Set([
	"pnpm-lock.yaml",
	"package-lock.json",
	"yarn.lock",
	"bun.lock",
	"bun.lockb",
]);

const CONFIG_FILE_NAMES = new Set([
	".gitignore",
	".npmrc",
	".env.example",
	".editorconfig",
	"biome.json",
	"wrangler.jsonc",
	"wrangler.toml",
]);

/** Tool configs by name: `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`. */
const CONFIG_FILE_PATTERN =
	/^(?:.+\.config\.(?:ts|js|mjs|cjs)|tsconfig(?:\..+)?\.json)$/;

const CODE_ICON = FileCode;
const IMAGE_ICON: FileIcon = {
	Icon: FileImage,
	colorClass: "text-(--code-string)",
};
const FONT_ICON: FileIcon = { Icon: FileType, colorClass: MUTED };

const ICON_BY_EXTENSION = new Map<string, FileIcon>([
	["tsx", { Icon: CODE_ICON, colorClass: "text-(--code-type)" }],
	["jsx", { Icon: CODE_ICON, colorClass: "text-(--code-type)" }],
	["ts", { Icon: CODE_ICON, colorClass: "text-(--code-function)" }],
	["mts", { Icon: CODE_ICON, colorClass: "text-(--code-function)" }],
	["cts", { Icon: CODE_ICON, colorClass: "text-(--code-function)" }],
	["js", { Icon: CODE_ICON, colorClass: "text-(--code-property)" }],
	["mjs", { Icon: CODE_ICON, colorClass: "text-(--code-property)" }],
	["cjs", { Icon: CODE_ICON, colorClass: "text-(--code-property)" }],
	["json", { Icon: FileBraces, colorClass: "text-(--code-property)" }],
	["jsonc", { Icon: FileBraces, colorClass: "text-(--code-property)" }],
	["css", { Icon: CODE_ICON, colorClass: "text-(--code-number)" }],
	["scss", { Icon: CODE_ICON, colorClass: "text-(--code-number)" }],
	["html", { Icon: CODE_ICON, colorClass: "text-(--code-keyword)" }],
	// Most template files are Markdown agent skills, so they stay neutral.
	["md", { Icon: FileText, colorClass: MUTED }],
	["mdx", { Icon: FileText, colorClass: MUTED }],
	["txt", { Icon: FileText, colorClass: MUTED }],
	["sql", { Icon: Database, colorClass: "text-(--code-string)" }],
	["yaml", { Icon: FileSliders, colorClass: "text-(--code-number)" }],
	["yml", { Icon: FileSliders, colorClass: "text-(--code-number)" }],
	["toml", { Icon: FileSliders, colorClass: "text-(--code-number)" }],
	["svg", IMAGE_ICON],
	["png", IMAGE_ICON],
	["jpg", IMAGE_ICON],
	["jpeg", IMAGE_ICON],
	["gif", IMAGE_ICON],
	["webp", IMAGE_ICON],
	["avif", IMAGE_ICON],
	["ico", IMAGE_ICON],
	["woff", FONT_ICON],
	["woff2", FONT_ICON],
	["ttf", FONT_ICON],
	["otf", FONT_ICON],
	["sh", { Icon: FileTerminal, colorClass: "text-(--code-string)" }],
]);

/** The last segment of a worktree path: `src/app.tsx` gives `app.tsx`. */
export function fileNameOf(path: string): string {
	return path.slice(path.lastIndexOf("/") + 1);
}

/** The lowercase extension of a file name. A leading dot, as in `.gitignore`, starts no extension. */
function extensionOf(name: string): string {
	const dot = name.lastIndexOf(".");
	return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

/** The language of `path` by its extension, or null for plain text like `.gitignore`. */
export function codeLanguageFor(path: string): CodeLanguage | null {
	return LANGUAGE_BY_EXTENSION.get(extensionOf(fileNameOf(path))) ?? null;
}

/** True for Markdown and text files, which wrap their long lines. */
export function isProsePath(path: string): boolean {
	return PROSE_EXTENSIONS.has(extensionOf(fileNameOf(path)));
}

/** The icon of a file name: full-name rules first, then the extension. */
export function fileIconFor(name: string): FileIcon {
	const lowerName = name.toLowerCase();
	if (LOCKFILE_NAMES.has(lowerName)) {
		return { Icon: FileLock, colorClass: MUTED };
	}
	if (CONFIG_FILE_NAMES.has(lowerName) || CONFIG_FILE_PATTERN.test(lowerName)) {
		return { Icon: FileCog, colorClass: MUTED };
	}
	return (
		ICON_BY_EXTENSION.get(extensionOf(lowerName)) ?? {
			Icon: File,
			colorClass: MUTED,
		}
	);
}

/**
 * Lines of a text for the status bar. A trailing newline ends the last line
 * and adds no line, as on GitHub. Empty text: 0.
 */
export function countLines(content: string): number {
	if (content === "") return 0;
	let breaks = 0;
	for (
		let index = content.indexOf("\n");
		index !== -1;
		index = content.indexOf("\n", index + 1)
	) {
		breaks += 1;
	}
	return content.endsWith("\n") ? breaks : breaks + 1;
}
