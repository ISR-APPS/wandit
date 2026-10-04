/**
 * Shared contract for the V2 preview token route and the phone link.
 *
 * The browser asks the API for a signed preview URL of the app's running
 * sandbox port; the preview domain (D5) validates the token. The
 * preview-proxy Worker also parses its host, mints the phone link for
 * Expo Go (WANDIT-193), and posts its error messages with this file.
 * The web builder parses the messages of the template dev bridge here, and
 * the turn body and `builder_turns.spec` reuse the picked targets.
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
 * Expo account name that the user types for the store Expo Go on an
 * iPhone. Expo Go opens a dev server only when the manifest names the
 * signed-in account. Letters, digits, `.`, `_`, and `-`, at most 64.
 */
export const expoUsernameSchema = z
	.string()
	.max(64)
	.regex(/^[A-Za-z0-9._-]+$/);

/**
 * Query of `GET /api/v2/projects/:id/preview-token`. No `client` gives the
 * iframe token. `client=phone` gives a token for the phone-link route of the
 * Worker, and only that form takes `expoUsername`.
 */
export const previewTokenQuerySchema = z
	.object({
		client: z.literal("phone").optional(),
		expoUsername: expoUsernameSchema.optional(),
	})
	.refine(
		(query) => query.expoUsername === undefined || query.client === "phone",
		{
			message: "expoUsername needs client=phone",
			path: ["expoUsername"],
		},
	);

/** TypeScript preview-token query. */
export type PreviewTokenQuery = z.infer<typeof previewTokenQuerySchema>;

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
	/** Expo Go account of the user, only on a phone token. The Worker writes it into the Expo manifest. */
	expoUsername: expoUsernameSchema.optional(),
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
 * Phone link lifetime in seconds. 60 minutes, not 15: Expo Go sends no
 * cookie, so the link cannot renew during a Fast Refresh session (D4 note).
 */
export const PHONE_LINK_TTL_SECONDS = 3600 as const;

/**
 * Path of the Worker route that mints a phone link. The caller POSTs a
 * phone preview token as the plain-text body to the run host. Only the
 * Worker answers it; the sandbox never sees it.
 */
export const PHONE_LINK_PATH = "/__wandit/phone-link" as const;

/**
 * Answer of the phone-link route. `expoUrl` is the `exps://` URL that Expo
 * Go opens; the Worker rejects it once `expiresAt` passes.
 */
export const phonePreviewLinkResponseSchema = z.object({
	expoUrl: z.string().startsWith("exps://"),
	expiresAt: isoDateTimeSchema,
});

/** TypeScript phone-link response. */
export type PhonePreviewLinkResponse = z.infer<
	typeof phonePreviewLinkResponseSchema
>;

/**
 * The part of an Expo Go manifest that the Worker changes: the username in
 * `extra.expoGo` (Expo CLI `ManifestMiddleware`, SDK 57). Loose objects
 * keep every other field, so the Worker writes the rest back unchanged.
 */
export const expoGoManifestSchema = z.looseObject({
	extra: z.looseObject({
		expoGo: z.looseObject({ username: z.string().optional() }),
	}),
});

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
 * Phone host of one phone link: `m-<phoneId>--p-<projectId>.<domain>`.
 * `phoneId` is 21 lower-case base32 characters, so the label has 63
 * characters, exactly the DNS limit.
 */
export function phonePreviewHostFor(
	projectId: string,
	phoneId: string,
	domain: string,
): string {
	return `m-${phoneId}--p-${projectId}.${domain}`;
}

/**
 * Fixed Metro host of one project: `p-<projectId>.<domain>`. The sandbox
 * sets `EXPO_PACKAGER_PROXY_URL=https://<this host>`, so every manifest URL
 * names it. The Worker serves no request on it and writes the phone host
 * over it in each manifest.
 */
export function packagerHostFor(projectId: string, domain: string): string {
	return `p-${projectId}.${domain}`;
}

/**
 * A parsed preview host. `run` is the iframe host of one sandbox run.
 * `phone` is the host of one phone link; its row in `PREVIEW_KV` holds the claims.
 */
export type PreviewHost =
	| { kind: "run"; projectId: string; rid12: string }
	| { kind: "phone"; projectId: string; phoneId: string };

/**
 * Parses a preview host into its kind and ids. Returns null for every host
 * that is not `r-<rid12>--p-<projectId>.<domain>` or
 * `m-<phoneId>--p-<projectId>.<domain>`. So the Worker answers 404 on the
 * apex domain, on the Metro host, and on foreign hosts.
 */
export function parsePreviewHost(
	host: string,
	domain: string,
): PreviewHost | null {
	// A bare `.` in a regex matches any character. The domain holds dots, so
	// the code escapes each regex metacharacter in it.
	const escapedDomain = domain
		.toLowerCase()
		.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const match = new RegExp(
		`^(?:r-([0-9a-f]{12})|m-([a-z2-7]{21}))--p-([0-9a-f-]{36})\\.${escapedDomain}$`,
	).exec(host.toLowerCase());
	const rid12 = match?.[1];
	const phoneId = match?.[2];
	const projectId = match?.[3];
	if (projectId === undefined) {
		return null;
	}
	if (rid12 !== undefined) {
		return { kind: "run", projectId, rid12 };
	}
	if (phoneId !== undefined) {
		return { kind: "phone", projectId, phoneId };
	}
	return null;
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

/**
 * Source location that the Vite plugin of the web template writes into
 * `data-wandit-src`: `<file>:<line>:<column>`, 1-based, with the file
 * relative to the app root. Example: `src/routes/index.tsx:42:7`. TanStack
 * route files hold `$`, `{}`, `()`, `[]`, and `_`. The app code in the preview
 * can post any string, so the format is checked.
 */
export const previewSourceLocationSchema = z
	.string()
	.max(512)
	.regex(/^[\w./@$()[\]{}+~-]+:[1-9]\d{0,5}:[1-9]\d{0,5}$/);

/**
 * One element that the user picked in the preview (WANDIT-203). The composer
 * shows it as a chip, the turn request carries it, and the turn task names it
 * in the prompt of the agent.
 */
export const previewTargetSchema = z.object({
	/** `data-wandit-src` of the element, see `previewSourceLocationSchema`. */
	src: previewSourceLocationSchema,
	/** Lower-case tag name of the element, for example `button`. */
	tag: z
		.string()
		.min(1)
		.max(32)
		.regex(/^[a-z][a-z0-9-]*$/),
	/** Visible text or accessible name, with the whitespace collapsed. "" when the element has none. */
	label: z
		.string()
		.max(80)
		// Half of a UTF-16 pair makes Postgres refuse the jsonb of the turn.
		// Each unit is a non-surrogate or a full pair; no ES2024 API, so every consumer can parse it.
		.regex(/^(?:[^\uD800-\uDFFF]|[\uD800-\uDBFF][\uDC00-\uDFFF])*$/),
});

/** One picked element: one composer chip and one line in the prompt of the agent. */
export type PreviewTarget = z.infer<typeof previewTargetSchema>;

/** Most targets one turn carries. The same limit as V1 `selectedTargets`. */
export const PREVIEW_TARGETS_MAX = 10 as const;

/**
 * Messages that the dev bridge of the web template
 * (`templates/web-app/src/wandit/preview-bridge.ts`) posts to the builder:
 * - `wandit:bridge-ready`: the bridge started. It posts this after each page load of the app.
 * - `wandit:runtime-error`: an uncaught error, a rejected promise, or a `console.error` call.
 * - `wandit:select-source`: the user clicked an element in select mode.
 * - `wandit:deselect`: the user pressed Escape in select mode.
 * The app code in the frame can post the same shapes, so every text is bounded.
 */
export const previewBridgeMessageSchema = z.discriminatedUnion("type", [
	z.object({ type: z.literal("wandit:bridge-ready") }),
	z.object({
		type: z.literal("wandit:runtime-error"),
		// The bridge cuts the message to 1000 and the stack to 4000 characters.
		message: z.string().min(1).max(1000),
		stack: z.string().max(4000).optional(),
	}),
	previewTargetSchema.extend({ type: z.literal("wandit:select-source") }),
	z.object({ type: z.literal("wandit:deselect") }),
]);

/** One message of the template dev bridge, after the schema check of the builder. */
export type PreviewBridgeMessage = z.infer<typeof previewBridgeMessageSchema>;
