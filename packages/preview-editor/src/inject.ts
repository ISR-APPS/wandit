// Render-time injection of the preview editor into the srcDoc HTML string.
// The TanStack cache keeps the CANONICAL html untouched — injection happens
// in a useMemo right before assigning srcDoc (page-tab.tsx), so the editor
// never leaks into anything the client could send back (it never sends HTML
// anyway — contract §7: the server is the only writer).

import {
	EDITOR_SCRIPT,
	EDITOR_SCRIPT_ID,
	EDITOR_STYLE,
	EDITOR_STYLE_ID,
} from "./editor-script";

const EDITOR_BLOCK = `<style id="${EDITOR_STYLE_ID}">${EDITOR_STYLE}</style><script id="${EDITOR_SCRIPT_ID}">${EDITOR_SCRIPT}</script>`;

/**
 * Insert the editor style + script immediately before the LAST `</body>`
 * (case-insensitive); with no body close tag, append at the end (contract
 * §11 fallback).
 */
export function injectPreviewEditor(html: string): string {
	const index = html.toLowerCase().lastIndexOf("</body>");
	if (index === -1) return html + EDITOR_BLOCK;
	return html.slice(0, index) + EDITOR_BLOCK + html.slice(index);
}
