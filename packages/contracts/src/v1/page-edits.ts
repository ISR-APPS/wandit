/**
 * Page edit-ops contract (V2 generation improvements, spec §5–§8).
 *
 * The browser accumulates ops client-side and POSTs one batch per Save; the
 * server is the ONLY writer of HTML. replace-section carries raw HTML and is
 * therefore server-internal (chat agent tool) — the HTTP endpoint rejects it.
 */
import { z } from "zod";
import { curatedFontIdSchema, type PAGE_TOKEN_NAMES } from "./page-theme";
import { pageVersionSummarySchema } from "./pages";
import { uuidSchema } from "./shared/primitives";

/** data-wid value: semantic slugs (hero, order-form), stamped leaves (e-12),
 *  and stamper fallbacks (sec-1) all match. */
export const widSchema = z
	.string()
	.min(1)
	.max(48)
	.regex(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/);

const hexColorSchema = z
	.string()
	.regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);

const fontSizePxSchema = z
	.string()
	.regex(/^\d{1,3}(\.\d+)?px$/)
	.refine((v) => {
		const n = Number.parseFloat(v);
		return n >= 8 && n <= 200;
	}, "font size must be between 8px and 200px");

const cssLengthSchema = z.string().regex(/^\d+(\.\d+)?(px|rem|em)$/);

/** Section padding step scale (inline-editor V3): the client sends STEPS,
 *  never CSS — the server builds the values from this frozen mapping. */
export const SECTION_PADDING_STEPS = ["none", "s", "m", "l", "xl"] as const;

export const sectionPaddingStepSchema = z.enum(SECTION_PADDING_STEPS);

export type SectionPaddingStep = z.infer<typeof sectionPaddingStepSchema>;

/** Step → CSS, shared by the server op application AND the client live
 *  preview so both always render the identical spacing. */
export const SECTION_PADDING_CSS: Record<SectionPaddingStep, string> = {
	none: "0",
	s: "clamp(1.5rem, 3vw, 2.5rem)",
	m: "clamp(2.5rem, 5vw, 4rem)",
	l: "clamp(4rem, 7vw, 6rem)",
	xl: "clamp(6rem, 10vw, 8.5rem)",
};

/**
 * Allowlisted link href (set-link-href): https/http URLs without embedded
 * credentials, tel: numbers, and mailto: addresses. Everything else —
 * javascript:, data:, vbscript:, protocol-relative, relative paths — is
 * rejected. Whitespace/control characters are rejected OUTRIGHT (browsers
 * strip them inside schemes, so "java\tscript:" would otherwise run); the
 * client normalizes phone numbers to digits before building tel: hrefs.
 */
export function isSafeLinkHref(value: string): boolean {
	for (const char of value) {
		if (char.charCodeAt(0) <= 0x20) {
			return false;
		}
	}

	const lowered = value.toLowerCase();

	if (lowered.startsWith("tel:")) {
		return /^\+?[0-9().#*-]{3,32}$/.test(value.slice(4));
	}

	if (lowered.startsWith("mailto:")) {
		const address = value.slice(7).split("?")[0] ?? "";

		return address.length >= 3 && address.includes("@");
	}

	if (lowered.startsWith("https://") || lowered.startsWith("http://")) {
		try {
			const parsed = new URL(value);

			return (
				(parsed.protocol === "https:" || parsed.protocol === "http:") &&
				parsed.username === "" &&
				parsed.password === ""
			);
		} catch {
			return false;
		}
	}

	return false;
}

export const linkHrefSchema = z
	.string()
	.min(1)
	.max(2048)
	.refine(isSafeLinkHref, "href must use https, http, tel: or mailto:");

export const textOpSchema = z.object({
	kind: z.literal("text"),
	wid: widSchema,
	value: z.string().max(4000),
});

export const imageSrcOpSchema = z.object({
	kind: z.literal("image-src"),
	wid: widSchema,
	value: z.url().max(2048),
});

export const elementStyleOpSchema = z.object({
	kind: z.literal("element-style"),
	wid: widSchema,
	value: z
		.object({
			color: hexColorSchema.optional(),
			fontSize: fontSizePxSchema.optional(),
			fontFamily: curatedFontIdSchema.optional(),
		})
		.refine((v) => Object.keys(v).length > 0, "at least one style property"),
});

const tokenValueSchemas = {
	background: hexColorSchema,
	foreground: hexColorSchema,
	primary: hexColorSchema,
	"primary-foreground": hexColorSchema,
	secondary: hexColorSchema,
	accent: hexColorSchema,
	muted: hexColorSchema,
	border: hexColorSchema,
	radius: cssLengthSchema,
	"font-heading": curatedFontIdSchema,
	"font-body": curatedFontIdSchema,
} as const satisfies Record<(typeof PAGE_TOKEN_NAMES)[number], z.ZodType>;

export const setTokensOpSchema = z.object({
	kind: z.literal("set-tokens"),
	value: z
		.object(
			Object.fromEntries(
				Object.entries(tokenValueSchemas).map(([k, s]) => [k, s.optional()]),
			) as {
				[K in keyof typeof tokenValueSchemas]: z.ZodOptional<
					(typeof tokenValueSchemas)[K]
				>;
			},
		)
		.refine(
			(v) => Object.values(v).some((x) => x !== undefined),
			"at least one token",
		),
});

/** Element removal (inline-editor V3) — the server restricts targets to
 *  <img> for now (ops.ts owns the tag check, same split as image-src). */
export const removeElementOpSchema = z.object({
	kind: z.literal("remove-element"),
	wid: widSchema,
});

export const setLinkHrefOpSchema = z.object({
	kind: z.literal("set-link-href"),
	wid: widSchema,
	value: linkHrefSchema,
});

const sectionBackgroundImageSchema = z.union([
	z.literal("none"),
	z
		.url()
		.max(2048)
		.refine((v) => v.startsWith("https://"), "background image must be https"),
]);

/** Section spacing/background (inline-editor V3): steps + a validated URL —
 *  the server builds the CSS, the client NEVER sends raw style strings. */
export const sectionStyleOpSchema = z.object({
	kind: z.literal("section-style"),
	wid: widSchema,
	value: z
		.object({
			paddingTop: sectionPaddingStepSchema.optional(),
			paddingBottom: sectionPaddingStepSchema.optional(),
			backgroundImage: sectionBackgroundImageSchema.optional(),
		})
		.refine(
			(v) => Object.keys(v).length > 0,
			"at least one section style property",
		),
});

/** SERVER-INTERNAL: produced by the chat agent's replace_section tool only. */
export const replaceSectionOpSchema = z.object({
	kind: z.literal("replace-section"),
	wid: widSchema,
	value: z.string().min(20).max(60_000),
});

export const clientEditOpSchema = z.discriminatedUnion("kind", [
	textOpSchema,
	imageSrcOpSchema,
	elementStyleOpSchema,
	removeElementOpSchema,
	setLinkHrefOpSchema,
	sectionStyleOpSchema,
	setTokensOpSchema,
]);

export const editOpSchema = z.discriminatedUnion("kind", [
	textOpSchema,
	imageSrcOpSchema,
	elementStyleOpSchema,
	removeElementOpSchema,
	setLinkHrefOpSchema,
	sectionStyleOpSchema,
	setTokensOpSchema,
	replaceSectionOpSchema,
]);

export type ClientEditOp = z.infer<typeof clientEditOpSchema>;
export type EditOp = z.infer<typeof editOpSchema>;

export const applyPageOpsBodySchema = z.object({
	baseVersionId: uuidSchema,
	source: z.enum(["inline", "theme"]),
	ops: z.array(clientEditOpSchema).min(1).max(200),
});

export type ApplyPageOpsBody = z.infer<typeof applyPageOpsBodySchema>;

export const applyPageOpsResponseSchema = z.object({
	version: pageVersionSummarySchema,
});

export type ApplyPageOpsResponse = z.infer<typeof applyPageOpsResponseSchema>;
