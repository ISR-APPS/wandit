import {
	type ClientEditOp,
	curatedFontStack,
	type PageTokenName,
	SECTION_PADDING_CSS,
} from "@wandit/contracts";

import type { ElementStylePatch, SectionStylePatch } from "./messages";

export type PendingPlaceholderImage = {
	width: number;
	height: number;
} | null;

export type SpeculativeTokenReset = {
	attempt: number;
	revision: number;
};

export type ResetPreviewFonts = {
	values: Partial<Record<PageTokenName, string>>;
	fontStylesheetHrefs: readonly string[];
};

const FONT_TOKEN_NAMES = ["font-heading", "font-body"] as const;
const INLINE_FORMATTING_TAGS = new Set([
	"EM",
	"I",
	"STRONG",
	"B",
	"U",
	"S",
	"SMALL",
	"MARK",
	"SUB",
	"SUP",
	"BR",
	"SPAN",
	"A",
]);

export type PendingElementStyle = Extract<
	ClientEditOp,
	{ kind: "element-style" }
>["value"];

export type PendingSectionStyle = Extract<
	ClientEditOp,
	{ kind: "section-style" }
>["value"];

export type PendingOpsSnapshot = {
	text: Record<string, string>;
	styles: Record<string, PendingElementStyle>;
	images: Record<string, string>;
	placeholderImages: Record<string, PendingPlaceholderImage>;
	brandLogos?: Record<string, string | null>;
	links: Record<string, string>;
	placeholders: Record<string, string>;
	removals: readonly string[];
	sectionStyles: Record<string, PendingSectionStyle>;
	tokens: Partial<Record<PageTokenName, string>>;
	tokensReset: boolean;
	/** Document <title> (browser tab) — head-level, so it carries no wid. */
	pageTitle?: string | null;
};

/** Build the one persisted batch in its dependency-safe order. Removals lead
 * so deleting a stamped inline child cannot be invalidated by a later text op
 * that flattens its parent. removeElement already prunes same-wid edits. */
export function buildPendingOps({
	text,
	styles,
	images,
	placeholderImages,
	brandLogos = {},
	links,
	placeholders,
	removals,
	sectionStyles,
	tokens,
	tokensReset,
	pageTitle = null,
}: PendingOpsSnapshot): ClientEditOp[] {
	const ops: ClientEditOp[] = [];

	for (const wid of removals) {
		ops.push({ kind: "remove-element", wid });
	}
	for (const [wid, value] of Object.entries(text)) {
		ops.push({ kind: "text", wid, value });
	}
	ops.push(...buildPendingImageOps(images, placeholderImages));
	// Brand wrappers keep their own wid but replace their descendants. Emit
	// swaps after image ops and before any descendant-sensitive style/link ops;
	// applyBrandLogo prunes those deleted descendant wids when recording.
	for (const [wid, value] of Object.entries(brandLogos)) {
		ops.push({ kind: "brand-logo", wid, value });
	}
	for (const [wid, value] of Object.entries(links)) {
		ops.push({ kind: "set-link-href", wid, value });
	}
	for (const [wid, value] of Object.entries(placeholders)) {
		ops.push({ kind: "set-placeholder", wid, value });
	}
	for (const [wid, value] of Object.entries(styles)) {
		ops.push({ kind: "element-style", wid, value });
	}
	for (const [wid, value] of Object.entries(sectionStyles)) {
		ops.push({ kind: "section-style", wid, value });
	}
	ops.push(...buildPendingTokenOps(tokensReset, tokens));
	// Head-level, order-independent: it targets no element the ops above move.
	if (pageTitle !== null) {
		ops.push({ kind: "set-page-title", value: pageTitle });
	}

	return ops;
}

/** Remove entries for descendants a parent text edit is about to flatten. */
export function omitPendingWids<T>(
	record: Record<string, T>,
	wids: readonly string[],
): Record<string, T> {
	if (wids.length === 0) return record;
	const dropped = new Set(wids);
	const entries = Object.entries(record).filter(([wid]) => !dropped.has(wid));
	return entries.length === Object.keys(record).length
		? record
		: Object.fromEntries(entries);
}

export function omitPendingRemovals(
	removals: string[],
	wids: readonly string[],
): string[] {
	if (wids.length === 0) return removals;
	const dropped = new Set(wids);
	const next = removals.filter((wid) => !dropped.has(wid));
	return next.length === removals.length ? removals : next;
}

/** Browser-DOM mirror of the server text guard's inline descendant set. */
export function hasOnlyInlineFormattingTags(
	descendantTagNames: readonly string[],
): boolean {
	return descendantTagNames.every((tagName) =>
		INLINE_FORMATTING_TAGS.has(tagName.toUpperCase()),
	);
}

/** Keep the builder's original font stylesheets while either effective font
 * still uses its reset value. During replay, an omitted override means the
 * reset value remains active; once both fonts are replaced, the links are
 * stale and the iframe can remove them. */
export function fontStylesheetHrefsForResetPreview(
	reset: ResetPreviewFonts | null,
	values: Partial<Record<PageTokenName, string>>,
	omittedValueUsesReset: boolean,
): readonly string[] {
	if (!reset) return [];
	const usesOriginalFont = FONT_TOKEN_NAMES.some((name) => {
		const value = values[name];
		return value === undefined
			? omittedValueUsesReset
			: value === reset.values[name];
	});

	return usesOriginalFont ? reset.fontStylesheetHrefs : [];
}

export function buildPendingImageOps(
	pendingImages: Record<string, string>,
	pendingPlaceholderImages: Record<string, PendingPlaceholderImage>,
): ClientEditOp[] {
	const ops: ClientEditOp[] = [];

	for (const [wid, value] of Object.entries(pendingImages)) {
		ops.push({ kind: "image-src", wid, value });
	}
	for (const [wid, value] of Object.entries(pendingPlaceholderImages)) {
		ops.push({
			kind: "placeholder-image",
			wid,
			...(value ? { value } : {}),
		});
	}

	return ops;
}

export function buildPendingTokenOps(
	pendingTokensReset: boolean,
	pendingTokens: Partial<Record<PageTokenName, string>>,
): ClientEditOp[] {
	const ops: ClientEditOp[] = [];

	if (pendingTokensReset) ops.push({ kind: "reset-tokens" });
	if (Object.keys(pendingTokens).length > 0) {
		ops.push({ kind: "set-tokens", value: pendingTokens });
	}

	return ops;
}

export function sourceForPendingOps(
	ops: readonly ClientEditOp[],
): "inline" | "theme" {
	return ops.length > 0 &&
		ops.every((op) => op.kind === "reset-tokens" || op.kind === "set-tokens")
		? "theme"
		: "inline";
}

export function countPendingTokenSlot(
	pendingTokensReset: boolean,
	pendingTokens: Partial<Record<PageTokenName, string>>,
): 0 | 1 {
	return pendingTokensReset || Object.keys(pendingTokens).length > 0 ? 1 : 0;
}

export function nextPendingTokensReset(
	current: boolean,
	saved: boolean,
	currentRevision = 0,
	savedRevision = 0,
): boolean {
	return saved ? current && currentRevision !== savedRevision : current;
}

export function shouldQueueTokenReset(
	baseIsOriginal: boolean,
	tokenSaveInFlight: boolean,
): boolean {
	return !baseIsOriginal || tokenSaveInFlight;
}

export function shouldClearSpeculativeTokenReset(
	reset: SpeculativeTokenReset | null,
	failedAttempt: number | null,
	currentRevision: number,
): boolean {
	return (
		reset !== null &&
		failedAttempt !== null &&
		reset.attempt === failedAttempt &&
		reset.revision === currentRevision
	);
}

// ── Shared live-patch resolvers ─────────────────────────────────────────────
// Persisted pending values → READY-to-apply postMessage payloads. Both the
// web iframe host and the native WebView host resolve identically so the
// live preview always matches what a save will persist.

/** Drop one wid's entry without touching the rest (identity kept when the
 *  wid was never recorded — no pointless re-renders). */
export function omitWid<T>(
	record: Record<string, T>,
	wid: string,
): Record<string, T> {
	if (!(wid in record)) return record;
	const { [wid]: _dropped, ...rest } = record;
	return rest;
}

/** Persisted element style → ready-to-apply CSS for the preview. Curated font
 *  ids are the sole property whose wire value differs from the saved op. */
export function resolveElementStylePatch(
	style: PendingElementStyle,
): ElementStylePatch {
	return {
		...(style.backgroundColor !== undefined
			? { backgroundColor: style.backgroundColor }
			: {}),
		...(style.borderRadius !== undefined
			? { borderRadius: style.borderRadius }
			: {}),
		...(style.color !== undefined ? { color: style.color } : {}),
		...(style.fontFamily !== undefined
			? { fontFamily: curatedFontStack(style.fontFamily) }
			: {}),
		...(style.fontSize !== undefined ? { fontSize: style.fontSize } : {}),
		...(style.fontStyle !== undefined ? { fontStyle: style.fontStyle } : {}),
		...(style.fontWeight !== undefined
			? { fontWeight: String(style.fontWeight) }
			: {}),
		...(style.letterSpacing !== undefined
			? { letterSpacing: style.letterSpacing }
			: {}),
		...(style.lineHeight !== undefined
			? { lineHeight: String(style.lineHeight) }
			: {}),
		...(style.objectFit !== undefined ? { objectFit: style.objectFit } : {}),
		...(style.textAlign !== undefined ? { textAlign: style.textAlign } : {}),
		...(style.width !== undefined ? { width: style.width } : {}),
	};
}

/** Pending section patch → READY CSS for the live message: steps through the
 *  frozen SECTION_PADDING_CSS scale, url wrapped in url("…") with the same
 *  escaping rule the server applies (backslash first, then quote), "none"
 *  passing through as the CLEAR sentinel. */
export function resolveSectionStylePatch(
	patch: PendingSectionStyle,
): SectionStylePatch {
	const resolved: SectionStylePatch = {};
	if (patch.paddingTop) {
		resolved.paddingTop = SECTION_PADDING_CSS[patch.paddingTop];
	}
	if (patch.paddingBottom) {
		resolved.paddingBottom = SECTION_PADDING_CSS[patch.paddingBottom];
	}
	if (patch.backgroundImage !== undefined) {
		resolved.backgroundImage =
			patch.backgroundImage === "none"
				? "none"
				: `url("${patch.backgroundImage.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}")`;
	}
	if (patch.backgroundColor !== undefined) {
		resolved.backgroundColor = patch.backgroundColor;
	}
	return resolved;
}

export function tokenValuesForPreview(
	tokens: Partial<Record<PageTokenName, string>>,
): Record<string, string> {
	const values: Record<string, string> = {};

	for (const [name, value] of Object.entries(tokens)) {
		if (value !== undefined) {
			values[name] = value;
		}
	}

	return values;
}

// ── Save pruning helpers ────────────────────────────────────────────────────
// After a successful save, only the entries the batch actually persisted are
// cleared: anything recorded while the request was in flight differs from
// the saved snapshot and stays pending (rebased onto the new version).

export function diffPendingValues<T>(
	current: Record<string, T>,
	saved: Record<string, T>,
): Record<string, T> {
	const next: Record<string, T> = {};
	for (const [wid, value] of Object.entries(current)) {
		if (saved[wid] !== value) next[wid] = value;
	}
	return next;
}

export function diffPendingStyles(
	current: Record<string, PendingElementStyle>,
	saved: Record<string, PendingElementStyle>,
): Record<string, PendingElementStyle> {
	const next: Record<string, PendingElementStyle> = {};
	for (const [wid, style] of Object.entries(current)) {
		const savedStyle = saved[wid];
		if (!savedStyle) {
			next[wid] = style;
			continue;
		}
		// Styles merge per property — keep only properties changed after the
		// snapshot. Iterate the contract-derived shape so new allowlisted fields
		// cannot be accidentally pruned while an earlier save is in flight.
		const leftover: PendingElementStyle = {};
		for (const [property, value] of Object.entries(style)) {
			const key = property as keyof PendingElementStyle;
			if (value !== undefined && value !== savedStyle[key]) {
				Object.assign(leftover, { [key]: value });
			}
		}
		if (Object.keys(leftover).length > 0) next[wid] = leftover;
	}
	return next;
}

export function diffPendingSectionStyles(
	current: Record<string, PendingSectionStyle>,
	saved: Record<string, PendingSectionStyle>,
): Record<string, PendingSectionStyle> {
	const next: Record<string, PendingSectionStyle> = {};
	for (const [wid, patch] of Object.entries(current)) {
		const savedPatch = saved[wid];
		if (!savedPatch) {
			next[wid] = patch;
			continue;
		}
		// Section styles merge per property too. Iterate the contract-derived
		// shape so a newly allowlisted property cannot be silently pruned.
		const leftover: PendingSectionStyle = {};
		for (const [property, value] of Object.entries(patch)) {
			const key = property as keyof PendingSectionStyle;
			if (value !== undefined && value !== savedPatch[key]) {
				Object.assign(leftover, { [key]: value });
			}
		}
		if (Object.keys(leftover).length > 0) next[wid] = leftover;
	}
	return next;
}

export function diffPendingTokens(
	current: Partial<Record<PageTokenName, string>>,
	saved: Partial<Record<PageTokenName, string>>,
): Partial<Record<PageTokenName, string>> {
	const next: Partial<Record<PageTokenName, string>> = {};
	for (const [name, value] of Object.entries(current) as [
		PageTokenName,
		string | undefined,
	][]) {
		if (value !== undefined && saved[name] !== value) next[name] = value;
	}
	return next;
}

export function diffPendingPlaceholderImages(
	current: Record<string, PendingPlaceholderImage>,
	saved: Record<string, PendingPlaceholderImage>,
): Record<string, PendingPlaceholderImage> {
	const next: Record<string, PendingPlaceholderImage> = {};

	for (const [wid, value] of Object.entries(current)) {
		const savedValue = saved[wid];
		const equal =
			wid in saved &&
			(value === null
				? savedValue === null
				: savedValue !== null &&
					savedValue !== undefined &&
					value.width === savedValue.width &&
					value.height === savedValue.height);

		if (!equal) {
			next[wid] = value;
		}
	}

	return next;
}
