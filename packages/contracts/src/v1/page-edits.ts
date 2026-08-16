/**
 * Page edit-ops contract (V2 generation improvements, spec §5–§8).
 *
 * The browser accumulates ops client-side and POSTs one batch per Save; the
 * server is the ONLY writer of HTML. Raw-HTML insert/replace ops are
 * server/AI-only — the HTTP endpoint rejects them.
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

const fontWeightSchema = z.union([
	z.enum(["normal", "bold"]),
	z.number().int().min(100).max(900).multipleOf(100),
]);

const letterSpacingEmSchema = z
	.string()
	.regex(/^-?\d+(\.\d+)?em$/)
	.refine((v) => {
		const n = Number.parseFloat(v);
		return n >= -0.05 && n <= 0.5;
	}, "letter spacing must be between -0.05em and 0.5em");

const borderRadiusSchema = z
	.string()
	.regex(/^\d+(\.\d+)?(px|rem)$/)
	.refine((v) => {
		if (v === "9999px") {
			return true;
		}

		const n = Number.parseFloat(v);
		return n >= 0 && n <= 64;
	}, "border radius must be between 0 and 64, or 9999px");

const widthPercentSchema = z
	.string()
	.regex(/^(?:[1-9]\d|100)%$/, "width must be an integer from 10% to 100%");

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

export const brandLogoOpSchema = z.object({
	kind: z.literal("brand-logo"),
	wid: widSchema,
	value: z.url().max(2048).nullable(),
});

/** Neutral inline-SVG placeholder (3:2). Detect persisted placeholders by
 *  data-wandit-placeholder, never by comparing this source string. */
export const PLACEHOLDER_IMAGE_SRC =
	"data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201200%20800'%3E%3Crect%20width='1200'%20height='800'%20fill='%23E2E8F0'/%3E%3Cg%20stroke='%2394A3B8'%20stroke-width='18'%20fill='none'%20stroke-linecap='round'%20stroke-linejoin='round'%3E%3Crect%20x='440'%20y='300'%20width='320'%20height='200'%20rx='16'/%3E%3Ccircle%20cx='530'%20cy='368'%20r='22'/%3E%3Cpath%20d='M472%20476l86-86%2062%2062%2054-54%2086%2078'/%3E%3C/g%3E%3C/svg%3E";

export const placeholderImageOpSchema = z.object({
	kind: z.literal("placeholder-image"),
	wid: widSchema,
	/** Rendered slot size in CSS px, measured when the edit is recorded. */
	value: z
		.object({
			width: z.number().int().min(1).max(10_000),
			height: z.number().int().min(1).max(10_000),
		})
		.optional(),
});

export const elementStyleOpSchema = z.object({
	kind: z.literal("element-style"),
	wid: widSchema,
	value: z
		.object({
			backgroundColor: hexColorSchema.optional(),
			borderRadius: borderRadiusSchema.optional(),
			color: hexColorSchema.optional(),
			fontStyle: z.enum(["normal", "italic"]).optional(),
			fontSize: fontSizePxSchema.optional(),
			fontFamily: curatedFontIdSchema.optional(),
			fontWeight: fontWeightSchema.optional(),
			letterSpacing: letterSpacingEmSchema.optional(),
			lineHeight: z.number().min(1).max(2.5).optional(),
			objectFit: z.enum(["cover", "contain"]).optional(),
			textAlign: z.enum(["start", "center", "end", "justify"]).optional(),
			width: widthPercentSchema.optional(),
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
		.strict()
		.refine(
			(v) => Object.values(v).some((x) => x !== undefined),
			"at least one token",
		),
});

/** Server-resolved restore of the newest builder-origin theme. */
export const resetTokensOpSchema = z.object({
	kind: z.literal("reset-tokens"),
});

/** Element removal (inline-editor V3) — the server restricts targets to
 *  stamped leaf elements; section elements are never removable. */
export const removeElementOpSchema = z.object({
	kind: z.literal("remove-element"),
	wid: widSchema,
});

export const setLinkHrefOpSchema = z.object({
	kind: z.literal("set-link-href"),
	wid: widSchema,
	value: linkHrefSchema,
});

export const setPlaceholderOpSchema = z.object({
	kind: z.literal("set-placeholder"),
	wid: widSchema,
	value: z.string().max(200),
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
			backgroundColor: hexColorSchema.optional(),
			paddingTop: sectionPaddingStepSchema.optional(),
			paddingBottom: sectionPaddingStepSchema.optional(),
			backgroundImage: sectionBackgroundImageSchema.optional(),
		})
		.refine(
			(v) => Object.keys(v).length > 0,
			"at least one section style property",
		),
});

/** SERVER/AI-ONLY: inserts one bounded HTML fragment relative to an element. */
export const insertElementOpSchema = z.object({
	kind: z.literal("insert-element"),
	wid: widSchema,
	position: z.enum(["before", "after", "append"]),
	value: z.string().min(1).max(60_000),
});

/** Curated element ops that are safe at the chat-tool boundary. */
export const aiElementOpSchema = z.discriminatedUnion("kind", [
	textOpSchema,
	imageSrcOpSchema,
	elementStyleOpSchema,
	setTokensOpSchema,
	setLinkHrefOpSchema,
	removeElementOpSchema,
	sectionStyleOpSchema,
	insertElementOpSchema,
]);

export type AiElementOp = z.infer<typeof aiElementOpSchema>;

/** SERVER-INTERNAL: produced by the chat agent's replace_section tool only. */
export const replaceSectionOpSchema = z.object({
	kind: z.literal("replace-section"),
	wid: widSchema,
	value: z.string().min(20).max(60_000),
});

/** SERVER-INTERNAL: produced by the chat agent's insert_section tool only. */
export const insertSectionOpSchema = z.object({
	kind: z.literal("insert-section"),
	wid: widSchema,
	position: z.enum(["before", "after"]),
	value: z.string().min(20).max(60_000),
});

export const clientEditOpSchema = z.discriminatedUnion("kind", [
	textOpSchema,
	imageSrcOpSchema,
	brandLogoOpSchema,
	placeholderImageOpSchema,
	elementStyleOpSchema,
	removeElementOpSchema,
	setLinkHrefOpSchema,
	setPlaceholderOpSchema,
	sectionStyleOpSchema,
	resetTokensOpSchema,
	setTokensOpSchema,
]);

export const editOpSchema = z.discriminatedUnion("kind", [
	textOpSchema,
	imageSrcOpSchema,
	brandLogoOpSchema,
	placeholderImageOpSchema,
	elementStyleOpSchema,
	removeElementOpSchema,
	setLinkHrefOpSchema,
	setPlaceholderOpSchema,
	sectionStyleOpSchema,
	resetTokensOpSchema,
	setTokensOpSchema,
	replaceSectionOpSchema,
	insertElementOpSchema,
	insertSectionOpSchema,
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
