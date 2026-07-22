// postMessage protocol between the app and the preview iframe (contract §11).
// The iframe is sandboxed with an OPAQUE origin (`event.origin === "null"`),
// so the security model is: accept child messages ONLY when `event.source`
// matches the iframe's contentWindow AND the payload parses against these
// schemas (see use-preview-bridge.ts); send parent messages with
// targetOrigin "*" — payloads only ever carry style values / wids already
// present in the page, never secrets.

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
	tag: z.string().min(1),
	kind: z.enum(["element", "section"]),
	text: z.string().nullable(),
	src: z.string().nullable(),
	/** <a> href as WRITTEN in the document (not resolved), else null. */
	href: z.string().nullable().default(null),
	/** COMPUTED section spacing/background — non-null only for
	 *  kind === "section". Defaulted so an older script still parses. */
	sectionStyles: z
		.object({
			paddingTop: z.string(),
			paddingBottom: z.string(),
			backgroundImage: z.string(),
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
		color: z.string(),
		fontSize: z.string(),
		fontFamily: z.string(),
	}),
});

export type PreviewSelection = z.infer<typeof selectPayloadSchema>;

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
		type: z.literal("text-edited"),
		payload: z.object({ wid: z.string().min(1), value: z.string() }),
	}),
]);

export type PreviewChildMessage = z.infer<typeof childMessageSchema>;

/** Parse an untrusted `message` event payload; null when it is not ours. */
export function parsePreviewMessage(data: unknown): PreviewChildMessage | null {
	const result = childMessageSchema.safeParse(data);
	return result.success ? result.data : null;
}

// ── Parent → child ─────────────────────────────────────────────────────────

/** Live element-style patch. `fontFamily` is a FULL CSS stack here (the app
 *  resolves curated ids before posting); the persisted op keeps the id. */
export type ElementStylePatch = {
	color?: string;
	fontSize?: string;
	fontFamily?: string;
};

/** Live section-style patch — READY CSS values (the app resolves padding
 *  steps via SECTION_PADDING_CSS and wraps background URLs in url("…")
 *  before posting; "none" means CLEAR the background overrides). */
export type SectionStylePatch = {
	paddingTop?: string;
	paddingBottom?: string;
	backgroundImage?: string;
};

type Envelope = {
	source: typeof PREVIEW_MESSAGE_SOURCE;
	v: typeof PREVIEW_PROTOCOL_VERSION;
};

export type PreviewParentMessage = Envelope &
	(
		| { type: "set-mode"; payload: { mode: EditorMode } }
		| {
				type: "apply-style";
				payload: { wid: string; style: ElementStylePatch };
		  }
		| { type: "swap-image"; payload: { wid: string; src: string } }
		| { type: "set-text"; payload: { wid: string; value: string } }
		| { type: "remove-element"; payload: { wid: string } }
		| { type: "set-link-href"; payload: { wid: string; href: string } }
		| {
				type: "apply-section-style";
				payload: { wid: string; style: SectionStylePatch };
		  }
		| {
				type: "set-tokens";
				payload: { values: Record<string, string>; fontsCss2Url?: string };
		  }
		| { type: "clear-selection"; payload: Record<string, never> }
	);

const ENVELOPE: Envelope = {
	source: PREVIEW_MESSAGE_SOURCE,
	v: PREVIEW_PROTOCOL_VERSION,
};

export function setModeMessage(mode: EditorMode): PreviewParentMessage {
	return { ...ENVELOPE, type: "set-mode", payload: { mode } };
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

/** Replay a pending TEXT edit into a freshly mounted iframe — used to keep
 *  unsaved edits visible when the preview remounts (e.g. after a save that
 *  had further edits recorded while it was in flight). */
export function setTextMessage(
	wid: string,
	value: string,
): PreviewParentMessage {
	return { ...ENVELOPE, type: "set-text", payload: { wid, value } };
}

/** Live-remove a stamped element (server op restricts targets to <img>;
 *  the script only needs the wid — discard restores via iframe remount). */
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

export function applySectionStyleMessage(
	wid: string,
	style: SectionStylePatch,
): PreviewParentMessage {
	return { ...ENVELOPE, type: "apply-section-style", payload: { wid, style } };
}

/** Token values arrive as READY-TO-APPLY CSS (fonts already as full stacks);
 *  `fontsCss2Url` lets the script upsert a live Google-Fonts preview link. */
export function setTokensMessage(
	values: Record<string, string>,
	fontsCss2Url?: string,
): PreviewParentMessage {
	return {
		...ENVELOPE,
		type: "set-tokens",
		payload: fontsCss2Url ? { values, fontsCss2Url } : { values },
	};
}

export function clearSelectionMessage(): PreviewParentMessage {
	return { ...ENVELOPE, type: "clear-selection", payload: {} };
}
