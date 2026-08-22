// Native page-editor types. The wire-level vocabulary (selection payloads,
// parent messages, pending ops, target comments) all comes from the shared
// @wandit/preview-editor package — this file only holds the native screen's
// own mode enum and small view helpers.

import type { PreviewSelection } from "@wandit/preview-editor";

/** The screen's three surfaces. Both "comment" and "edit" drive the injected
 * script in its "select" mode (click-to-target); inline contentEditable
 * ("edit" script mode) stays web-only — native edits text in a sheet input. */
export type PageEditorMode = "view" | "comment" | "edit";

export function scriptModeFor(mode: PageEditorMode): "browse" | "select" {
	return mode === "view" ? "browse" : "select";
}

/** Short human label for a tapped target: the visible excerpt when there is
 * one, else the tag name (web target-chip parity). */
export function targetLabel(selection: {
	excerpt: string | null;
	tag: string;
}): string {
	const excerpt = selection.excerpt?.trim();
	return excerpt && excerpt.length > 0 ? excerpt : `<${selection.tag}>`;
}

export type { PreviewSelection };
