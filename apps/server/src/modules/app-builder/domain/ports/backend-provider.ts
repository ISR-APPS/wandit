/**
 * Port: the managed backend behind a V2 app (D18, hidden Supabase
 * project). The provisioning task and the backend host tools call it;
 * WANDIT-183 implements it on the Supabase platform API.
 */

/** Nest token for the `BackendProvider` implementation. */
export const BACKEND_PROVIDER = Symbol.for("app-builder.backend-provider");

/** EU regions allowed by the residency decision (D8: Paris, Frankfurt). */
export type BackendRegion = "eu-west-3" | "eu-central-1";

/**
 * Provider-side lifecycle of a backend project, normalized to the states
 * the API reports. `unknown` covers provider states we do not map.
 */
export type BackendProjectStatus =
	| "coming_up"
	| "active_healthy"
	| "paused"
	| "restoring"
	| "removed"
	| "unknown";

/** One managed backend per project. */
export interface BackendProvider {
	readonly providerId: "supabase";
	/** Creates the hidden Supabase project; returns its ref and our org id. */
	createProject(input: {
		name: string;
		region: BackendRegion;
		dbPassword: string;
		/** Supabase instance size name, for example "micro". From `SUPABASE_PLATFORM_INSTANCE_SIZE`. */
		instanceSize: string;
	}): Promise<{ ref: string; orgId: string }>;
	getProject(
		ref: string,
	): Promise<{ status: BackendProjectStatus; dbHost: string | null }>;
	getApiKeys(ref: string): Promise<{ anonKey: string; serviceRoleKey: string }>;
	runSql(ref: string, sql: string): Promise<void>;
	/** Auth URLs the app's sign-in accepts. */
	updateAuthConfig(
		ref: string,
		input: { siteUrl: string; uriAllowList: string[] },
	): Promise<void>;
	pauseProject(ref: string): Promise<void>;
	restoreProject(ref: string): Promise<void>;
	deleteProject(ref: string): Promise<void>;
}
