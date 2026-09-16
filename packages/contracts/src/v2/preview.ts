/**
 * Shared contract for the V2 preview token route.
 *
 * The browser asks the API for a signed preview URL of the app's running
 * sandbox port; the preview domain (D5) validates the token. The
 * preview-proxy Worker also parses its host and posts its error messages
 * with the helpers and schema in this file.
 */
import { z } from "zod";
import { isoDateTimeSchema, uuidSchema } from "../v1/shared/primitives";

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

/**
 * Claims inside the signed preview token. The API `PreviewTokenService`
 * writes them; the preview-proxy Worker reads them after it verifies the
 * signature.
 */
export const previewTokenClaimsSchema = z.object({
	/** Project id (`projects.id`). The Worker compares it to the host label. */
	pid: uuidSchema,
	/** Run id (`sandbox_sessions.id`). The Worker compares its `rid12` form to the host label. */
	rid: uuidSchema,
	/** User id of the workspace member the API minted the token for. */
	uid: z.string().min(1),
	/** Origin the proxy forwards to, for example `https://x-5173.vercel.run`. Comes from `sandbox_sessions.previewHost`. */
	up: z.url(),
	/** Expiry time in unix seconds. The Worker rejects the token at `exp <= now`. */
	exp: z.int(),
	/** Token id, at least 16 characters. The Worker rate-limits on it. */
	jti: z.string().min(16),
});

/** TypeScript preview-token claims. */
export type PreviewTokenClaims = z.infer<typeof previewTokenClaimsSchema>;

/**
 * Name of the cookie that carries the token after the `?wt=` redirect.
 * The `__Host-` prefix makes the browser accept the cookie only with
 * `Secure`, `Path=/`, and no `Domain`. So the generated app cannot set a
 * domain cookie that overwrites it (security.md 9.1).
 */
export const PREVIEW_COOKIE_NAME = "__Host-wandit_preview" as const;

/**
 * Token lifetime in seconds. 15 minutes: one preview session, and a
 * leaked token expires soon.
 */
export const PREVIEW_TOKEN_TTL_SECONDS = 900 as const;

/**
 * Query parameter that carries the token on the first request
 * (`?wt=<token>`). Short name: it sits in every preview URL the API
 * returns. The Worker answers it with the cookie and a redirect.
 */
export const PREVIEW_TOKEN_QUERY = "wt" as const;

/**
 * First 12 hex characters of a run id without dashes. The host label uses
 * this short form so one DNS label stays under 63 characters.
 */
export function rid12Of(runId: string): string {
	return runId.replaceAll("-", "").slice(0, 12);
}

/**
 * Preview host of one project and run:
 * `r-<rid12>--p-<projectId>.<domain>`. One origin per project and run keeps
 * the cookies and storage of the generated app isolated. The builder and
 * other projects cannot read them (D5, security.md 9.3).
 */
export function previewHostFor(
	projectId: string,
	runId: string,
	domain: string,
): string {
	return `r-${rid12Of(runId)}--p-${projectId}.${domain}`;
}

/**
 * Parses a preview host back into its project id and `rid12`. Returns null
 * for every host that does not match `r-<rid12>--p-<projectId>.<domain>`.
 * So the Worker answers 404 on the apex domain and on foreign hosts.
 */
export function parsePreviewHost(
	host: string,
	domain: string,
): { projectId: string; rid12: string } | null {
	// A bare `.` in a regex matches any character. The domain holds dots, so
	// the code escapes each regex metacharacter in it.
	const escapedDomain = domain
		.toLowerCase()
		.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const match = new RegExp(
		`^r-([0-9a-f]{12})--p-([0-9a-f-]{36})\\.${escapedDomain}$`,
	).exec(host.toLowerCase());
	const rid12 = match?.[1];
	const projectId = match?.[2];
	if (rid12 === undefined || projectId === undefined) {
		return null;
	}
	return { projectId, rid12 };
}

/**
 * Message the error pages of the preview proxy post to the parent frame.
 * The builder shell (WANDIT-173) listens for it to refresh the token or to
 * show the stopped state.
 */
export const previewParentMessageSchema = z.object({
	type: z.literal("wandit:preview"),
	event: z.enum(["token-expired", "not-running"]),
});

/** TypeScript parent-frame message. */
export type PreviewParentMessage = z.infer<typeof previewParentMessageSchema>;
