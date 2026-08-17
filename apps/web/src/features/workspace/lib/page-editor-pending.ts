import type { ClientEditOp, PageTokenName } from "@wandit/contracts";

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

type PendingElementStyle = Extract<
	ClientEditOp,
	{ kind: "element-style" }
>["value"];

type PendingSectionStyle = Extract<
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
