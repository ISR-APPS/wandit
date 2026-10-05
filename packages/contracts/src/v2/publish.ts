/**
 * Publish contract of a V2 app: the name of its user Worker, the fields of
 * the KV host pointer, and the reason codes of a suspended app.
 * The publish-app task (WANDIT-178), the domains pipeline, and the admin
 * suspend switch (WANDIT-181) write the pointer. The edge Worker (apps/edge/src/index.ts) reads it and
 * imports this file by its path. No zod here: a schema call cannot be
 * tree-shaken, and it would put zod into the edge bundle.
 */

/**
 * Builds the script name of the user Worker of one app inside the dispatch
 * namespace. The publish task uploads under this name; the edge dispatches to it.
 */
export function appWorkerName(projectId: string): string {
	return `app-${projectId}`;
}

/**
 * Reason codes of a suspended app. The admin suspend route builds
 * `z.enum(suspendedReasonCodes)` at its HTTP boundary, and the DB enum
 * `project_suspended_reason` copies this list. Keep the prefixes: the edge
 * answers 451 for `abuse_` and `legal_`, 410 for the rest.
 */
export const suspendedReasonCodes = [
	// A fake login, bank, or wallet page.
	"abuse_phishing",
	// The app spreads malware or a harmful download.
	"abuse_malware",
	// A URL scan provider marked the live URL as harmful.
	"abuse_url_scan",
	// A court order or an authority asks to remove the app.
	"legal_takedown",
	// A legal notice (for example a copyright claim) is under review.
	"legal_notice",
	// The app breaks the terms of service in another way.
	"tos_violation",
	// The account has an unpaid balance.
	"billing",
	// Staff hold the app while they check a report.
	"manual_review",
] as const;

/** One value of `suspendedReasonCodes`. */
export type SuspendedReasonCode = (typeof suspendedReasonCodes)[number];

/**
 * Per-request ceilings of one user Worker. The dispatch namespace stops the
 * Worker with an error past either value.
 */
export type AppWorkerLimits = {
	/** CPU time per request, in milliseconds. */
	cpuMs: number;
	/** Outbound `fetch` calls per request. */
	subRequests: number;
};

/**
 * Limits the edge applies to a pointer without `limits`. 100 ms CPU covers
 * one SSR render with margin; 50 subrequests cover one page of Supabase
 * calls. The publish task (WANDIT-178) writes these values for every plan.
 */
export const DEFAULT_APP_WORKER_LIMITS: AppWorkerLimits = {
	cpuMs: 100,
	subRequests: 50,
};

/**
 * KV value at `domain:{host}`. `projectId` is the only required field: the
 * domains pipeline writes `{projectId, source: "domain"}` for a V1 page and
 * `appHostPointer` for a V2 app. Readers tolerate unknown extra fields.
 */
export type HostPointer = {
	/** Id of the project the host serves (`projects.id`, a uuid). */
	projectId: string;
	/** `"app"` sends the request to the user Worker (V2). Absent: the V1 R2 page. */
	kind?: "app";
	/** Who wrote the pointer: publishing (`slug`) or the domains pipeline (`domain`). */
	source?: "slug" | "domain";
	/** The `{slug}` of a `{slug}.wandit.app` host. Only a `slug` pointer carries it. */
	slug?: string;
	/** `"suspended"` blocks the host: 403 for a V1 page, 451 or 410 for an app. */
	status?: "suspended";
	/** Why the app is suspended. `appHostPointer` writes it together with `status`. */
	reasonCode?: SuspendedReasonCode;
	/** Plan limits of the user Worker. Absent means `DEFAULT_APP_WORKER_LIMITS`. */
	limits?: AppWorkerLimits;
};

/**
 * Builds the KV pointer of one host of a V2 app. The publish task writes
 * it for the slug host and every active custom domain, the domains
 * pipeline writes it at activation, and the suspend switch rewrites it.
 * A suspended project gets `status` and `reasonCode` on every host, so no
 * writer can undo a take-down.
 */
export function appHostPointer(input: {
	/** Id of the V2 project (`projects.id`). */
	projectId: string;
	/** `slug` for the `{slug}.wandit.app` host, `domain` for a custom domain. */
	source: "slug" | "domain";
	/** The `{slug}` of the slug host. Null for a custom domain. */
	slug: string | null;
	/** `projects.suspended_reason_code`; null when the project is not suspended. */
	suspendedReasonCode: SuspendedReasonCode | null;
}): HostPointer {
	return {
		kind: "app",
		// LIMIT: one limit for every plan. Upgrade: read the plan limits.
		limits: DEFAULT_APP_WORKER_LIMITS,
		projectId: input.projectId,
		source: input.source,
		...(input.slug === null ? {} : { slug: input.slug }),
		...(input.suspendedReasonCode === null
			? {}
			: { reasonCode: input.suspendedReasonCode, status: "suspended" }),
	};
}
