/**
 * Read-only CodeMirror 6 editor of the Code view: line numbers, colors,
 * selection, and the find panel (Mod-F). code-viewer.tsx loads it with
 * React.lazy, so CodeMirror stays out of the builder chunk. One EditorView
 * lives as long as this component; a new file replaces its state. Colors
 * come from the `--code-*` tokens in apps/web/src/index.css.
 */

import { defaultKeymap } from "@codemirror/commands";
import {
	bracketMatching,
	HighlightStyle,
	type LanguageSupport,
	syntaxHighlighting,
} from "@codemirror/language";
import {
	highlightSelectionMatches,
	search,
	searchKeymap,
} from "@codemirror/search";
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import {
	drawSelection,
	EditorView,
	highlightActiveLine,
	highlightActiveLineGutter,
	highlightSpecialChars,
	keymap,
	lineNumbers,
} from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { Sentry } from "@wandit/observability/browser";
import { useEffect, useMemo, useRef } from "react";

import { useTranslation } from "@/lib/i18n";
import { codeLanguageFor, isProsePath } from "../../lib/code-files";

export type CodeEditorProps = {
	/** Path relative to the worktree root. Picks the language and the line wrap. */
	path: string;
	/** The UTF-8 text of the file. */
	content: string;
};

/**
 * Set explicitly: `:lang(ar)` in index.css maps `--font-mono` to a
 * proportional Arabic face, and code needs a monospace face in every locale.
 */
const CODE_FONT_FAMILY =
	'"Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

/** The look of the editor. Only CSS variables, so the `.dark` class switches it with no JS. */
const wanditTheme = EditorView.theme({
	"&": {
		height: "100%",
		fontSize: "13px",
		color: "var(--foreground)",
		backgroundColor: "var(--background)",
	},
	"&.cm-focused": { outline: "none" },
	".cm-scroller": {
		fontFamily: CODE_FONT_FAMILY,
		lineHeight: "20px",
		// globals.css sets -0.025em on `html`; code keeps its grid.
		letterSpacing: "0",
		fontVariantLigatures: "none",
	},
	".cm-content": { padding: "12px 0", caretColor: "var(--foreground)" },
	".cm-line": { paddingInline: "16px" },
	".cm-gutters": {
		backgroundColor: "var(--background)",
		color: "color-mix(in oklab, var(--muted-foreground) 75%, transparent)",
		border: "none",
	},
	".cm-lineNumbers .cm-gutterElement": {
		minWidth: "3ch",
		paddingInline: "12px 0",
		fontVariantNumeric: "tabular-nums",
	},
	// The active line shows only while the editor has focus; else line 1
	// is lit on every open.
	"&.cm-focused .cm-activeLine": {
		backgroundColor: "var(--code-active-line)",
	},
	".cm-activeLine": { backgroundColor: "transparent" },
	".cm-activeLineGutter": { backgroundColor: "transparent" },
	"&.cm-focused .cm-activeLineGutter": { color: "var(--foreground)" },
	"&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
		{ backgroundColor: "var(--code-selection)" },
	".cm-searchMatch": { backgroundColor: "var(--code-match)" },
	".cm-searchMatch.cm-searchMatch-selected": {
		backgroundColor: "var(--code-selection)",
		outline: "1px solid var(--code-keyword)",
	},
	".cm-selectionMatch": { backgroundColor: "var(--code-match)" },
	"&.cm-focused .cm-matchingBracket": {
		backgroundColor: "var(--code-match)",
	},
	".cm-panels": {
		backgroundColor: "var(--sidebar)",
		color: "var(--foreground)",
	},
	".cm-panels.cm-panels-top": { borderBottom: "1px solid var(--border)" },
	".cm-panel.cm-search, .cm-panel.cm-gotoLine": {
		display: "flex",
		flexWrap: "wrap",
		alignItems: "center",
		gap: "6px",
		padding: "6px 12px",
		fontFamily: "inherit",
		fontSize: "13px",
	},
	".cm-panel.cm-search br": { display: "none" },
	".cm-textfield": {
		height: "28px",
		margin: "0",
		padding: "0 8px",
		border: "1px solid var(--border)",
		borderRadius: "8px",
		backgroundColor: "var(--background)",
		color: "var(--foreground)",
		fontSize: "13px",
	},
	".cm-textfield:focus": {
		outline: "2px solid color-mix(in oklab, var(--ring) 50%, transparent)",
	},
	".cm-button": {
		height: "28px",
		margin: "0",
		padding: "0 10px",
		border: "1px solid var(--border)",
		borderRadius: "9999px",
		backgroundImage: "none",
		backgroundColor: "var(--background)",
		color: "var(--foreground)",
		fontSize: "12px",
	},
	".cm-button:hover": { backgroundColor: "var(--accent)" },
	".cm-panel.cm-search label": {
		display: "inline-flex",
		alignItems: "center",
		gap: "4px",
		color: "var(--muted-foreground)",
		fontSize: "12px",
	},
	".cm-panel.cm-search [name=close], .cm-panel.cm-gotoLine [name=close]": {
		position: "static",
		marginInlineStart: "auto",
		fontSize: "18px",
		color: "var(--muted-foreground)",
		cursor: "pointer",
	},
});

/** Lezer tags to the `--code-*` tokens. Markdown uses the same colors. */
const wanditHighlight = HighlightStyle.define([
	{
		tag: [
			tags.keyword,
			tags.controlKeyword,
			tags.moduleKeyword,
			tags.definitionKeyword,
			tags.operatorKeyword,
			tags.modifier,
		],
		color: "var(--code-keyword)",
	},
	{
		tag: [
			tags.string,
			tags.special(tags.string),
			tags.regexp,
			tags.attributeValue,
			tags.character,
		],
		color: "var(--code-string)",
	},
	{
		tag: [tags.number, tags.bool, tags.null, tags.atom, tags.unit],
		color: "var(--code-number)",
	},
	{
		tag: [
			tags.function(tags.variableName),
			tags.function(tags.propertyName),
			tags.function(tags.definition(tags.variableName)),
		],
		color: "var(--code-function)",
	},
	{
		tag: [tags.typeName, tags.className, tags.namespace, tags.tagName],
		color: "var(--code-type)",
	},
	{
		tag: [
			tags.propertyName,
			tags.attributeName,
			tags.labelName,
			tags.definition(tags.propertyName),
		],
		color: "var(--code-property)",
	},
	{
		tag: [
			tags.comment,
			tags.lineComment,
			tags.blockComment,
			tags.docComment,
			tags.meta,
		],
		color: "var(--code-comment)",
		fontStyle: "italic",
	},
	{
		tag: [tags.punctuation, tags.bracket, tags.operator, tags.separator],
		color: "var(--code-punctuation)",
	},
	{ tag: tags.invalid, color: "var(--destructive)" },
	{ tag: tags.heading, color: "var(--code-keyword)", fontWeight: "600" },
	{ tag: tags.strong, fontWeight: "600" },
	{ tag: tags.emphasis, fontStyle: "italic" },
	{
		tag: [tags.link, tags.url],
		color: "var(--code-function)",
		textDecoration: "underline",
	},
	{ tag: tags.monospace, color: "var(--code-string)" },
	{ tag: tags.quote, color: "var(--code-comment)" },
	{ tag: tags.list, color: "var(--code-punctuation)" },
]);

/** Every file shares these. `readOnly`, not `editable: false`: the caret, selection, and Mod-F keep working. */
const BASE_EXTENSIONS: Extension = [
	lineNumbers(),
	highlightActiveLineGutter(),
	highlightActiveLine(),
	drawSelection(),
	highlightSpecialChars(),
	bracketMatching(),
	search({ top: true }),
	highlightSelectionMatches(),
	keymap.of([...defaultKeymap, ...searchKeymap]),
	EditorState.readOnly.of(true),
	EditorState.tabSize.of(2),
	// No phone keyboard on a file that nobody can type into.
	EditorView.contentAttributes.of({ translate: "no", inputmode: "none" }),
	wanditTheme,
	syntaxHighlighting(wanditHighlight),
];

/**
 * Grammars that loaded once, by language label. A cached grammar goes into
 * the first state of a file, so a file switch shows no plain-text frame.
 */
const loadedLanguages = new Map<string, LanguageSupport>();

/** Shows one file. A new `path` or `content` replaces the state and scrolls to the top. */
export default function CodeEditor({ path, content }: CodeEditorProps) {
	const { t } = useTranslation();
	const hostRef = useRef<HTMLDivElement>(null);
	const viewRef = useRef<EditorView | null>(null);
	// The English phrases are the keys that @codemirror/search asks for.
	const phrases = useMemo(
		() =>
			EditorState.phrases.of({
				Find: t("appBuilder.code.search.find"),
				next: t("appBuilder.code.search.next"),
				previous: t("appBuilder.code.search.previous"),
				all: t("appBuilder.code.search.all"),
				"match case": t("appBuilder.code.search.matchCase"),
				regexp: t("appBuilder.code.search.regexp"),
				"by word": t("appBuilder.code.search.byWord"),
				close: t("appBuilder.code.search.close"),
				"current match": t("appBuilder.code.search.currentMatch"),
				"on line": t("appBuilder.code.search.onLine"),
				"Go to line": t("appBuilder.code.search.goToLine"),
				go: t("appBuilder.code.search.go"),
			}),
		[t],
	);

	useEffect(() => {
		const host = hostRef.current;
		if (host === null) return;
		const view = new EditorView({ parent: host });
		viewRef.current = view;
		return () => {
			view.destroy();
			viewRef.current = null;
		};
	}, []);

	useEffect(() => {
		const view = viewRef.current;
		if (view === null) return;
		const language = codeLanguageFor(path);
		const languageSlot = new Compartment();
		const cached = language ? loadedLanguages.get(language.label) : undefined;
		view.setState(
			EditorState.create({
				doc: content,
				extensions: [
					BASE_EXTENSIONS,
					phrases,
					isProsePath(path) ? EditorView.lineWrapping : [],
					languageSlot.of(cached ?? []),
				],
			}),
		);
		if (language === null || cached !== undefined) return;
		// Plain text shows until the grammar chunk arrives.
		let isCurrentFile = true;
		language
			.load()
			.then((support) => {
				loadedLanguages.set(language.label, support);
				if (isCurrentFile) {
					view.dispatch({ effects: languageSlot.reconfigure(support) });
				}
			})
			.catch((error: unknown) => {
				// A failed chunk keeps the plain text on screen; the report
				// says which grammar failed.
				Sentry.captureException(error, {
					tags: { source: "code-editor" },
					extra: { language: language.label },
				});
			});
		return () => {
			isCurrentFile = false;
		};
	}, [path, content, phrases]);

	return (
		// A path and code read left to right in every locale.
		<div
			ref={hostRef}
			dir="ltr"
			translate="no"
			className="[&_.cm-scroller]:scroll-warm h-full min-h-0 [&_.cm-editor]:h-full"
		/>
	);
}
