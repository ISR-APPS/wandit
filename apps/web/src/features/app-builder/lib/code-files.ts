/**
 * File-type rules of the Code view: the CodeMirror language, the tree icon,
 * the line wrap, the line count of a file, and the code font. Called by
 * components/code/code-editor.tsx, code-viewer.tsx, and file-tree.tsx.
 * Each grammar is a dynamic import, so it loads as its own lazy chunk.
 */

import type { LanguageSupport } from "@codemirror/language";
import type { Icon } from "@phosphor-icons/react";
import { BracketsCurlyIcon } from "@phosphor-icons/react/BracketsCurly";
import { FileCodeIcon } from "@phosphor-icons/react/FileCode";
import { FileCssIcon } from "@phosphor-icons/react/FileCss";
import { FileHtmlIcon } from "@phosphor-icons/react/FileHtml";
import { FileImageIcon } from "@phosphor-icons/react/FileImage";
import { FileJsIcon } from "@phosphor-icons/react/FileJs";
import { FileJsxIcon } from "@phosphor-icons/react/FileJsx";
import { FileMdIcon } from "@phosphor-icons/react/FileMd";
import { FileSqlIcon } from "@phosphor-icons/react/FileSql";
import { FileTextIcon } from "@phosphor-icons/react/FileText";
import { FileTsIcon } from "@phosphor-icons/react/FileTs";
import { FileTsxIcon } from "@phosphor-icons/react/FileTsx";
import { GearSixIcon } from "@phosphor-icons/react/GearSix";
import { LockSimpleIcon } from "@phosphor-icons/react/LockSimple";
import { TerminalWindowIcon } from "@phosphor-icons/react/TerminalWindow";
import { TextAaIcon } from "@phosphor-icons/react/TextAa";

/**
 * The font of code and paths, set explicitly: `:lang(ar)` in index.css maps
 * `--font-mono` to a proportional Arabic face, and code needs a monospace
 * face in every locale. The editor and the path breadcrumb use it.
 */
export const CODE_FONT_FAMILY =
	'"Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

/** A language that the editor colors. */
export type CodeLanguage = {
	/** Name in the language chip of the editor header, for example "TypeScript". A proper noun, never translated. */
	label: string;
	/** Loads the grammar chunk. The editor keeps the answer for later files. */
	load: () => Promise<LanguageSupport>;
};

/** The icon of a file in the tree and in the breadcrumb. */
export type FileIcon = {
	/** A Phosphor icon. The tree and the breadcrumb draw it in the duotone weight. */
	Icon: Icon;
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

/** Prose, configs, and unknown files: the faint ink of the brand, with its dark twin. */
const MUTED = "text-night/45 dark:text-foreground/45";

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

const IMAGE_ICON: FileIcon = {
	Icon: FileImageIcon,
	colorClass: "text-(--code-string)",
};
const FONT_ICON: FileIcon = { Icon: TextAaIcon, colorClass: MUTED };

const ICON_BY_EXTENSION = new Map<string, FileIcon>([
	["tsx", { Icon: FileTsxIcon, colorClass: "text-(--code-type)" }],
	["jsx", { Icon: FileJsxIcon, colorClass: "text-(--code-type)" }],
	["ts", { Icon: FileTsIcon, colorClass: "text-(--code-function)" }],
	["mts", { Icon: FileTsIcon, colorClass: "text-(--code-function)" }],
	["cts", { Icon: FileTsIcon, colorClass: "text-(--code-function)" }],
	["js", { Icon: FileJsIcon, colorClass: "text-(--code-property)" }],
	["mjs", { Icon: FileJsIcon, colorClass: "text-(--code-property)" }],
	["cjs", { Icon: FileJsIcon, colorClass: "text-(--code-property)" }],
	["json", { Icon: BracketsCurlyIcon, colorClass: "text-(--code-property)" }],
	["jsonc", { Icon: BracketsCurlyIcon, colorClass: "text-(--code-property)" }],
	["css", { Icon: FileCssIcon, colorClass: "text-(--code-number)" }],
	["scss", { Icon: FileCssIcon, colorClass: "text-(--code-number)" }],
	["html", { Icon: FileHtmlIcon, colorClass: "text-(--code-keyword)" }],
	// Most template files are Markdown agent skills, so they stay neutral.
	["md", { Icon: FileMdIcon, colorClass: MUTED }],
	["mdx", { Icon: FileMdIcon, colorClass: MUTED }],
	["txt", { Icon: FileTextIcon, colorClass: MUTED }],
	["sql", { Icon: FileSqlIcon, colorClass: "text-(--code-string)" }],
	["yaml", { Icon: FileCodeIcon, colorClass: "text-(--code-number)" }],
	["yml", { Icon: FileCodeIcon, colorClass: "text-(--code-number)" }],
	["toml", { Icon: FileCodeIcon, colorClass: "text-(--code-number)" }],
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
	["sh", { Icon: TerminalWindowIcon, colorClass: "text-(--code-string)" }],
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
		return { Icon: LockSimpleIcon, colorClass: MUTED };
	}
	if (CONFIG_FILE_NAMES.has(lowerName) || CONFIG_FILE_PATTERN.test(lowerName)) {
		return { Icon: GearSixIcon, colorClass: MUTED };
	}
	return (
		ICON_BY_EXTENSION.get(extensionOf(lowerName)) ?? {
			Icon: FileTextIcon,
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
