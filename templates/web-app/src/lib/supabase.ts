// Supabase client factory for browser and server code.
// Routes and server functions call getSupabase() / getSupabaseServer().
// D18: a missing env var throws at startup; there is no null-client path.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function readEnv(name: string): string {
	// Browser code reads Vite's injected env; server code reads the worker env.
	const viteValue = import.meta.env[name];
	if (typeof viteValue === "string" && viteValue.length > 0) {
		return viteValue;
	}
	// `process` does not exist in a browser bundle; the guard keeps the check safe.
	if (typeof process !== "undefined") {
		const processValue = process.env[name];
		if (processValue) {
			return processValue;
		}
	}
	throw new Error(
		`Missing ${name}. The project backend is provisioned at creation. ` +
			"Ask the host to re-provision instead of removing the check.",
	);
}

function makeClient(accessToken?: string): SupabaseClient {
	return createClient(
		readEnv("VITE_SUPABASE_URL"),
		readEnv("VITE_SUPABASE_ANON_KEY"),
		// The user JWT in the header makes PostgREST apply RLS as that user.
		accessToken
			? { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
			: undefined,
	);
}

let browserClient: SupabaseClient | undefined;

/** Browser singleton. Throws on first call when the env vars are absent. */
export function getSupabase(): SupabaseClient {
	if (!browserClient) {
		browserClient = makeClient();
	}
	return browserClient;
}

/**
 * Server-side client for createServerFn handlers. Not cached: worker env can differ.
 * With `accessToken`, requests run under that user's RLS policies.
 */
export function getSupabaseServer(accessToken?: string): SupabaseClient {
	return makeClient(accessToken);
}
