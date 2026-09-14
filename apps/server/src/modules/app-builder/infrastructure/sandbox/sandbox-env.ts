/**
 * Builds the process env of a V2 sandbox.
 * The builder-turn task calls it once per turn from the `projects` row,
 * the `app_backends` row, and the per-run proxy token; the provider then
 * passes the result to the vendor and to every command it runs inside.
 * The allow list is the whole security boundary: only the names below can
 * ever enter the VM, so a platform secret cannot leak through `extra`.
 */
import { SandboxEnvRejectedError } from "../../domain/errors/sandbox-env-rejected.error";

/**
 * The only env names a sandbox may receive. Every other name — a Vercel
 * token, a real Anthropic key, a Supabase service role key, a signing key —
 * is a platform secret and must stay out of the VM.
 */
export const SANDBOX_ENV_ALLOW_LIST = [
	"ANTHROPIC_AUTH_TOKEN",
	"ANTHROPIC_BASE_URL",
	"ANTHROPIC_API_KEY",
	"ANTHROPIC_CUSTOM_HEADERS",
	"VITE_SUPABASE_ANON_KEY",
	"VITE_SUPABASE_URL",
	"WANDIT_PREVIEW_HOST",
] as const;

/** One allow-listed env name. */
export type SandboxEnvName = (typeof SANDBOX_ENV_ALLOW_LIST)[number];

/** Inputs `buildSandboxEnv` needs. All come from the caller, not from env. */
export type SandboxEnvInput = {
	/** The LLM proxy base URL; becomes `ANTHROPIC_BASE_URL`. */
	proxyBaseUrl: string;
	/** The per-run proxy token; becomes `ANTHROPIC_AUTH_TOKEN`. */
	proxyToken: string;
	/** The builder-turn run id; lands in `ANTHROPIC_CUSTOM_HEADERS` so the proxy can attribute spend. */
	runId: string;
	/** Public Supabase URL of the project's backend, from `app_backends`. */
	supabaseUrl: string;
	/** Public anon key of the project's backend, from `app_backends`. */
	supabaseAnonKey: string;
	/** Host serving the app preview; omitted from the env when null. */
	previewHost: string | null;
	/**
	 * Extra values the caller adds. Untyped on purpose: the allow-list
	 * check below is the boundary, and it throws `SandboxEnvRejectedError`
	 * for any name outside `SANDBOX_ENV_ALLOW_LIST`.
	 */
	extra?: Record<string, string>;
};

/**
 * Returns the exact env map for one sandbox start or resume.
 * `ANTHROPIC_API_KEY` is deliberately empty: the proxy holds the real key,
 * and an empty value stops the CLI from reading one from the environment.
 */
export function buildSandboxEnv(
	input: SandboxEnvInput,
): Record<string, string> {
	const env: Record<string, string> = {
		ANTHROPIC_AUTH_TOKEN: input.proxyToken,
		ANTHROPIC_BASE_URL: input.proxyBaseUrl,
		// Security: the real Anthropic key lives on the proxy, never in the VM.
		ANTHROPIC_API_KEY: "",
		ANTHROPIC_CUSTOM_HEADERS: `X-Wandit-Run: ${input.runId}`,
		VITE_SUPABASE_ANON_KEY: input.supabaseAnonKey,
		VITE_SUPABASE_URL: input.supabaseUrl,
	};
	if (input.previewHost !== null) {
		env.WANDIT_PREVIEW_HOST = input.previewHost;
	}
	const allowed = new Set<string>(SANDBOX_ENV_ALLOW_LIST);
	for (const [name, value] of Object.entries(input.extra ?? {})) {
		if (!allowed.has(name)) {
			throw new SandboxEnvRejectedError(name);
		}
		env[name] = value;
	}
	// Security: the key stays empty even when `extra` reintroduces the name.
	env.ANTHROPIC_API_KEY = "";
	return env;
}
