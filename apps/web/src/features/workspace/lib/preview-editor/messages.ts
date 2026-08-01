// postMessage protocol between the app and the preview iframe (contract §11).
// The iframe is sandboxed with an OPAQUE origin (`event.origin === "null"`),
// so the security model is: accept child messages ONLY when `event.source`
// matches the iframe's contentWindow AND the payload parses against these
// schemas (see use-preview-bridge.ts); send parent messages with
// targetOrigin "*" — payloads only ever carry style values / wids already
// present in the page, never secrets.

import { PLACEHOLDER_IMAGE_SRC } from "@wandit/contracts";
import { z } from "zod";

export const PREVIEW_MESSAGE_SOURCE = "wandit-preview";
export const PREVIEW_PROTOCOL_VERSION = 1;

export const editorModeSchema = z.enum(["browse", "select", "edit"]);
export type EditorMode = z.infer<typeof editorModeSchema>;

// ── Child → parent ─────────────────────────────────────────────────────────

/** Payload of a `select` message — everything the inspector needs to render
 *  without asking the iframe anything else. `styles` are COMPUTED values. */
const selectPayloadSchema = z.object({
	wid: z.string().min(1),
	sectionWid: z.string().min(1).nullable(),
	tag: z.string().min(1).max(32),
	kind: z.enum(["element", "surface", "section"]),
	/** Visible-text summary for chips. Unlike `text`, this is populated for
	 * every target kind and is never used to decide inline text editing. */
	excerpt: z.string().max(160).nullable().default(null),
	/** Deep-first target ladder owned by the iframe. Defaults keep selection
	 * payloads from an older injected script deploy-compatible. */
	ladder: z
		.array(
			z.object({
				wid: z.string().min(1),
				kind: z.enum(["element", "surface", "section"]),
				tag: z.string().min(1).max(32),
				label: z.string().min(1).max(120),
			}),
		)
		.default([]),
	ladderIndex: z.number().int().nonnegative().default(0),
	text: z.string().nullable(),
	src: z.string().nullable(),
	/** Inline image width as authored (computed width resolves percentages to px). */
	inlineWidth: z.string().nullable().default(null),
	/** False when remove-element would break a form's lead capture/submission. */
	removable: z.boolean().default(true),
	/** False when edit-mode text entry cannot safely flatten this target. */
	textEditable: z.boolean().default(true),
	/** Marker-based placeholder state for IMG targets. */
	isPlaceholderImage: z.boolean().default(false),
	/** <input>/<textarea> placeholder as written, else null. */
	placeholder: z.string().nullable().default(null),
	/** <a> href as WRITTEN in the document (not resolved), else null. */
	href: z.string().nullable().default(null),
	/** COMPUTED section spacing/background — non-null only for
	 *  kind === "section". Defaulted so an older script still parses. */
	sectionStyles: z
		.object({
			paddingTop: z.string(),
			paddingBottom: z.string(),
			backgroundImage: z.string(),
			backgroundColor: z.string().default("transparent"),
		})
		.nullable()
		.default(null),
	/** First full-bleed IMG descendant of a selected section (≥90% cover in both
	 *  axes) — the section's de-facto background. Defaulted so an older script
	 *  still parses. */
	bgImage: z
		.object({ wid: z.string().min(1), src: z.string().nullable() })
		.nullable()
		.default(null),
	styles: z.object({
		backgroundColor: z.string(),
		borderRadius: z.string(),
		color: z.string(),
		direction: z.string(),
		fontFamily: z.string(),
		fontSize: z.string(),
		fontStyle: z.string(),
		fontWeight: z.string(),
		height: z.string().default(""),
		letterSpacing: z.string(),
		lineHeight: z.string(),
		objectFit: z.string(),
		textAlign: z.string(),
		width: z.string(),
	}),
});

export type PreviewSelection = z.infer<typeof selectPayloadSchema>;

const selectionRectPayloadSchema = z.object({
	wid: z.string().min(1),
	left: z.number(),
	top: z.number(),
	width: z.number().nonnegative(),
	height: z.number().nonnegative(),
});

export type PreviewSelectionRect = z.infer<typeof selectionRectPayloadSchema>;

const envelope = {
	source: z.literal(PREVIEW_MESSAGE_SOURCE),
	v: z.literal(PREVIEW_PROTOCOL_VERSION),
} as const;

const childMessageSchema = z.discriminatedUnion("type", [
	z.object({ ...envelope, type: z.literal("ready"), payload: z.object({}) }),
	z.object({
		...envelope,
		type: z.literal("select"),
		payload: selectPayloadSchema,
	}),
	z.object({ ...envelope, type: z.literal("deselect"), payload: z.object({}) }),
	z.object({
		...envelope,
		type: z.literal("selection-rect"),
		payload: selectionRectPayloadSchema.nullable(),
	}),
	z.object({ ...envelope, type: z.literal("escape"), payload: z.object({}) }),
	z.object({
		...envelope,
		type: z.literal("ask-ai-shortcut"),
		payload: z.object({}),
	}),
	z.object({
		...envelope,
		type: z.literal("text-edited"),
		payload: z.object({
			wid: z.string().min(1),
			value: z.string(),
			/** Stamped inline descendants removed by the flattening preview. */
			flattenedWids: z.array(z.string().min(1)).default([]),
		}),
	}),
]);

export type PreviewChildMessage = z.infer<typeof childMessageSchema>;

/** Parse an untrusted `message` event payload; null when it is not ours. */
export function parsePreviewMessage(data: unknown): PreviewChildMessage | null {
	const result = childMessageSchema.safeParse(data);
	return result.success ? result.data : null;
}

export function selectionRectMessage(
	rect: PreviewSelectionRect | null,
): PreviewChildMessage {
	return {
		source: PREVIEW_MESSAGE_SOURCE,
		v: PREVIEW_PROTOCOL_VERSION,
		type: "selection-rect",
		payload: rect,
	};
}

// ── Parent → child ─────────────────────────────────────────────────────────

/** Live element-style patch. `fontFamily` is a FULL CSS stack here (the app
 *  resolves curated ids before posting); the persisted op keeps the id. */
export type ElementStylePatch = {
	backgroundColor?: string;
	borderRadius?: string;
	color?: string;
	fontFamily?: string;
	fontSize?: string;
	fontStyle?: string;
	fontWeight?: string;
	letterSpacing?: string;
	lineHeight?: string;
	objectFit?: string;
	textAlign?: string;
	width?: string;
};

/** Live section-style patch — READY CSS values (the app resolves padding
 *  steps via SECTION_PADDING_CSS and wraps background URLs in url("…")
 *  before posting; "none" means CLEAR the background overrides). */
export type SectionStylePatch = {
	paddingTop?: string;
	paddingBottom?: string;
	backgroundImage?: string;
	backgroundColor?: string;
};

export type PreviewCommentPin = {
	wid: string;
	number: number;
};

type Envelope = {
	source: typeof PREVIEW_MESSAGE_SOURCE;
	v: typeof PREVIEW_PROTOCOL_VERSION;
};

export type PreviewParentMessage = Envelope &
	(
		| { type: "set-mode"; payload: { mode: EditorMode } }
		| { type: "set-suspended"; payload: { suspended: boolean } }
		| { type: "select-target"; payload: { wid: string } }
		| {
				type: "apply-style";
				payload: { wid: string; style: ElementStylePatch };
		  }
		| { type: "swap-image"; payload: { wid: string; src: string } }
		| {
				type: "set-brand-logo";
				payload: { wid: string; value: string | null };
		  }
		| { type: "set-comment-pins"; payload: { pins: PreviewCommentPin[] } }
		| { type: "set-ai-targets"; payload: { wids: string[] } }
		| {
				type: "placeholder-image";
				payload: {
					wid: string;
					src: string;
					width?: number;
					height?: number;
				};
		  }
		| { type: "set-text"; payload: { wid: string; value: string } }
		| { type: "remove-element"; payload: { wid: string } }
		| { type: "set-link-href"; payload: { wid: string; href: string } }
		| { type: "set-placeholder"; payload: { wid: string; value: string } }
		| {
				type: "apply-section-style";
				payload: { wid: string; style: SectionStylePatch };
		  }
		| {
				type: "set-tokens";
				payload: {
					values: Record<string, string>;
					fontsCss2Url?: string;
					fontStylesheetHrefs?: string[];
				};
		  }
		| { type: "clear-selection"; payload: Record<string, never> }
	);

const GOOGLE_FONT_STYLESHEET_PREFIX = "https://fonts.googleapis.com/";

function hasUrlWhitespaceOrControl(value: string): boolean {
	for (let index = 0; index < value.length; index += 1) {
		const code = value.charCodeAt(index);
		if (code <= 0x20 || code === 0x7f) return true;
	}
	return false;
}

function isGoogleFontStylesheetHref(href: string): boolean {
	if (
		!href.startsWith(GOOGLE_FONT_STYLESHEET_PREFIX) ||
		hasUrlWhitespaceOrControl(href)
	) {
		return false;
	}

	try {
		return new URL(href).origin === "https://fonts.googleapis.com";
	} catch {
		return false;
	}
}

const googleFontStylesheetHrefSchema = z
	.url()
	.refine(
		isGoogleFontStylesheetHref,
		"font stylesheet href must use fonts.googleapis.com",
	);

export const fontStylesheetHrefsSchema = z
	.array(googleFontStylesheetHrefSchema)
	.default([]);

const elementStylePatchSchema = z.object({
	backgroundColor: z.string().optional(),
	borderRadius: z.string().optional(),
	color: z.string().optional(),
	fontFamily: z.string().optional(),
	fontSize: z.string().optional(),
	fontStyle: z.string().optional(),
	fontWeight: z.string().optional(),
	letterSpacing: z.string().optional(),
	lineHeight: z.string().optional(),
	objectFit: z.string().optional(),
	textAlign: z.string().optional(),
	width: z.string().optional(),
});

const sectionStylePatchSchema = z.object({
	paddingTop: z.string().optional(),
	paddingBottom: z.string().optional(),
	backgroundImage: z.string().optional(),
	backgroundColor: z.string().optional(),
});

const setTokensPayloadSchema = z.object({
	values: z.record(z.string(), z.string()),
	fontsCss2Url: googleFontStylesheetHrefSchema.optional(),
	fontStylesheetHrefs: fontStylesheetHrefsSchema,
});

const commentPinSchema = z.object({
	wid: z.string().min(1),
	number: z.number().int().min(1).max(10),
});

const commentPinsSchema = z.array(commentPinSchema).max(10);
const aiTargetWidsSchema = z.array(z.string().min(1)).max(10);

/** Zod mirror for the receiving iframe. The embedded script repeats the
 * security-sensitive URL check because generated page code shares its realm. */
const parentMessageSchema = z.discriminatedUnion("type", [
	z.object({
		...envelope,
		type: z.literal("set-mode"),
		payload: z.object({ mode: editorModeSchema }),
	}),
	z.object({
		...envelope,
		type: z.literal("set-suspended"),
		payload: z.object({ suspended: z.boolean() }),
	}),
	z.object({
		...envelope,
		type: z.literal("select-target"),
		payload: z.object({ wid: z.string().min(1) }),
	}),
	z.object({
		...envelope,
		type: z.literal("apply-style"),
		payload: z.object({ wid: z.string(), style: elementStylePatchSchema }),
	}),
	z.object({
		...envelope,
		type: z.literal("swap-image"),
		payload: z.object({ wid: z.string(), src: z.string() }),
	}),
	z.object({
		...envelope,
		type: z.literal("set-brand-logo"),
		payload: z.object({
			wid: z.string().min(1),
			value: z.url().max(2048).nullable(),
		}),
	}),
	z.object({
		...envelope,
		type: z.literal("set-comment-pins"),
		payload: z.object({ pins: commentPinsSchema }),
	}),
	z.object({
		...envelope,
		type: z.literal("set-ai-targets"),
		payload: z.object({ wids: aiTargetWidsSchema }),
	}),
	z.object({
		...envelope,
		type: z.literal("placeholder-image"),
		payload: z.object({
			wid: z.string(),
			src: z.string(),
			width: z.number().optional(),
			height: z.number().optional(),
		}),
	}),
	z.object({
		...envelope,
		type: z.literal("set-text"),
		payload: z.object({ wid: z.string(), value: z.string() }),
	}),
	z.object({
		...envelope,
		type: z.literal("remove-element"),
		payload: z.object({ wid: z.string() }),
	}),
	z.object({
		...envelope,
		type: z.literal("set-link-href"),
		payload: z.object({ wid: z.string(), href: z.string() }),
	}),
	z.object({
		...envelope,
		type: z.literal("set-placeholder"),
		payload: z.object({ wid: z.string(), value: z.string() }),
	}),
	z.object({
		...envelope,
		type: z.literal("apply-section-style"),
		payload: z.object({ wid: z.string(), style: sectionStylePatchSchema }),
	}),
	z.object({
		...envelope,
		type: z.literal("set-tokens"),
		payload: setTokensPayloadSchema,
	}),
	z.object({
		...envelope,
		type: z.literal("clear-selection"),
		payload: z.object({}),
	}),
]);

export function parsePreviewParentMessage(
	data: unknown,
): PreviewParentMessage | null {
	const result = parentMessageSchema.safeParse(data);
	return result.success ? (result.data as PreviewParentMessage) : null;
}

const ENVELOPE: Envelope = {
	source: PREVIEW_MESSAGE_SOURCE,
	v: PREVIEW_PROTOCOL_VERSION,
};

export function setModeMessage(mode: EditorMode): PreviewParentMessage {
	return { ...ENVELOPE, type: "set-mode", payload: { mode } };
}

export function setSuspendedMessage(suspended: boolean): PreviewParentMessage {
	return { ...ENVELOPE, type: "set-suspended", payload: { suspended } };
}

export function selectTargetMessage(wid: string): PreviewParentMessage {
	return { ...ENVELOPE, type: "select-target", payload: { wid } };
}

export function applyStyleMessage(
	wid: string,
	style: ElementStylePatch,
): PreviewParentMessage {
	return { ...ENVELOPE, type: "apply-style", payload: { wid, style } };
}

export function swapImageMessage(
	wid: string,
	src: string,
): PreviewParentMessage {
	return { ...ENVELOPE, type: "swap-image", payload: { wid, src } };
}

export function setBrandLogoMessage(
	wid: string,
	value: string | null,
): PreviewParentMessage {
	return { ...ENVELOPE, type: "set-brand-logo", payload: { wid, value } };
}

export function setCommentPinsMessage(
	pins: readonly PreviewCommentPin[],
): PreviewParentMessage {
	return {
		...ENVELOPE,
		type: "set-comment-pins",
		payload: { pins: commentPinsSchema.parse(pins) },
	};
}

export function setAiTargetsMessage(
	wids: readonly string[],
): PreviewParentMessage {
	return {
		...ENVELOPE,
		type: "set-ai-targets",
		payload: { wids: aiTargetWidsSchema.parse(wids) },
	};
}

export function placeholderImageMessage(
	wid: string,
	dims?: { width: number; height: number },
): PreviewParentMessage {
	return {
		...ENVELOPE,
		type: "placeholder-image",
		payload: { wid, src: PLACEHOLDER_IMAGE_SRC, ...(dims ?? {}) },
	};
}

/** Replay a pending TEXT edit into a freshly mounted iframe — used to keep
 *  unsaved edits visible when the preview remounts (e.g. after a save that
 *  had further edits recorded while it was in flight). */
export function setTextMessage(
	wid: string,
	value: string,
): PreviewParentMessage {
	return { ...ENVELOPE, type: "set-text", payload: { wid, value } };
}

/** Live-remove a stamped leaf; the script only needs the wid — discard
 *  restores the canonical node via iframe remount. */
export function removeElementMessage(wid: string): PreviewParentMessage {
	return { ...ENVELOPE, type: "remove-element", payload: { wid } };
}

/** Live href swap on a stamped <a> — the href is already allowlist-validated
 *  (isSafeLinkHref) before it gets here. */
export function setLinkHrefMessage(
	wid: string,
	href: string,
): PreviewParentMessage {
	return { ...ENVELOPE, type: "set-link-href", payload: { wid, href } };
}

/** Live placeholder update on a stamped <input>/<textarea>. */
export function setPlaceholderMessage(
	wid: string,
	value: string,
): PreviewParentMessage {
	return { ...ENVELOPE, type: "set-placeholder", payload: { wid, value } };
}

export function applySectionStyleMessage(
	wid: string,
	style: SectionStylePatch,
): PreviewParentMessage {
	return { ...ENVELOPE, type: "apply-section-style", payload: { wid, style } };
}

/** Token values arrive as READY-TO-APPLY CSS (fonts already as full stacks).
 * `fontsCss2Url` is the curated-font link; `fontStylesheetHrefs` carries the
 * original builder links for reset previews. Both are preview-only. */
export function setTokensMessage(
	values: Record<string, string>,
	fontsCss2Url?: string,
	fontStylesheetHrefs: readonly string[] = [],
): PreviewParentMessage {
	return {
		...ENVELOPE,
		type: "set-tokens",
		payload: setTokensPayloadSchema.parse({
			values,
			...(fontsCss2Url ? { fontsCss2Url } : {}),
			fontStylesheetHrefs,
		}),
	};
}

export function clearSelectionMessage(): PreviewParentMessage {
	return { ...ENVELOPE, type: "clear-selection", payload: {} };
}
