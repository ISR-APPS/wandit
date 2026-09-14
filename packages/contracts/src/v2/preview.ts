/**
 * Shared contract for the V2 preview token route.
 *
 * The browser asks the API for a signed preview URL of the app's running
 * sandbox port; the preview domain (D5) validates the token.
 */
import { z } from "zod";
import { isoDateTimeSchema } from "../v1/shared/primitives";

/**
 * Answer of the preview-token route. `token` signs `previewUrl`; the
 * preview edge rejects the URL once `expiresAt` passes.
 */
export const previewTokenResponseSchema = z.object({
	token: z.string(),
	previewUrl: z.url(),
	expiresAt: isoDateTimeSchema,
});

/** TypeScript preview-token response. */
export type PreviewTokenResponse = z.infer<typeof previewTokenResponseSchema>;
