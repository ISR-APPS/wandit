import { z } from "zod";

/** API-origin cookie written by the public UTM attribution endpoint. */
export const UTM_ATTRIBUTION_COOKIE_NAME = "wandit_utm_attribution";

const utmAttributionValueSchema = z.string().trim().min(1).max(200);
const utmAttributionContentSchema = z.string().trim().min(1).max(500);
const utmAttributionLandingPathSchema = z
	.string()
	.trim()
	.min(1)
	.max(2_048)
	.regex(/^\/(?!\/)/);
const utmAttributionReferrerSchema = z.string().trim().min(1).max(2_048);

export const utmAttributionBodySchema = z
	.object({
		utmSource: utmAttributionValueSchema.optional(),
		utmMedium: utmAttributionValueSchema.optional(),
		utmCampaign: utmAttributionValueSchema.optional(),
		utmContent: utmAttributionContentSchema.optional(),
		landingPath: utmAttributionLandingPathSchema,
		referrer: utmAttributionReferrerSchema.optional(),
	})
	.strict()
	.refine(
		(value) => value.utmSource !== undefined || value.referrer !== undefined,
		{
			message: "At least one of utmSource or referrer must be provided",
		},
	);

export type UtmAttributionBody = z.infer<typeof utmAttributionBodySchema>;

export const attributionRoutes = {
	captureUtm: "/api/v1/attribution/utm",
} as const;
