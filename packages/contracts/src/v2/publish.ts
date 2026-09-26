/**
 * Publish contract of a V2 app: the name of its user Worker, the fields of
 * the KV host pointer, and the reason codes of a suspended app.
 * The publish-app task (WANDIT-178) and the suspend switch (WANDIT-181)
 * write the pointer. The edge Worker (apps/edge/src/index.ts) reads it and
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
 * Reason codes of a suspended app. WANDIT-181 adds codes here and builds
 * `z.enum(suspendedReasonCodes)` at its HTTP boundary. Keep the prefixes:
 * the edge answers 451 for `abuse_` and `legal_`, 410 for the rest.
 */
export const suspendedReasonCodes = [
	"abuse_phishing",
	"legal_takedown",
	"billing",
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
 * calls. WANDIT-178 writes the plan values into the pointer.
 */
export const DEFAULT_APP_WORKER_LIMITS: AppWorkerLimits = {
	cpuMs: 100,
	subRequests: 50,
};

/**
 * KV value at `domain:{host}`. `projectId` is the only required field: the
 * domains pipeline writes `{projectId, source: "domain"}` with no deploy
 * knowledge. Readers tolerate unknown extra fields.
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
	/** Why the app is suspended. WANDIT-181 writes it together with `status`. */
	reasonCode?: SuspendedReasonCode;
	/** Plan limits of the user Worker. Absent means `DEFAULT_APP_WORKER_LIMITS`. */
	limits?: AppWorkerLimits;
};
