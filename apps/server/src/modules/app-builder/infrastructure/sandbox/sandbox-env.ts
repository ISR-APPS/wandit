/**
 * Builds the process env of a V2 sandbox and writes the backend `.env` file.
 * The builder-turn task calls `buildSandboxEnv` once per turn. The provider
 * passes the result to the vendor and to every command it runs inside.
 * The allow list is the boundary of the process env: only its names enter it.
 * The builder-turn task, provision-backend, and `startSandboxWithoutTurn`
 * call `syncBackendEnvFile`. The builder-turn task and
 * `startSandboxWithoutTurn` read the backend with `activeBackendEnvOf`.
 */
import { posix } from "node:path";

import { supabaseProjectUrl } from "@wandit/contracts";

import { SandboxEnvRejectedError } from "../../domain/errors/sandbox-env-rejected.error";
import type { SandboxReader } from "../../domain/ports/sandbox-provider";
import type { AppBackendRow } from "../persistence/app-backends.repository";
import { TEMPLATE_PROFILES } from "./template-profiles";

/**
 * The only env names a sandbox may receive. Every other name — a Vercel
 * token, a real Anthropic key, a Supabase service role key, a signing key —
 * is a platform secret and must stay out of the VM. The Supabase names are
 * not here. Vite, and Expo CLI at start, prefer a process value to a `.env`
 * value. So the Supabase names go only to `syncBackendEnvFile`.
 */
export const SANDBOX_ENV_ALLOW_LIST = [
	"ANTHROPIC_AUTH_TOKEN",
	"ANTHROPIC_BASE_URL",
	"ANTHROPIC_API_KEY",
	"ANTHROPIC_CUSTOM_HEADERS",
	"CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC",
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
	// Deny-by-default egress: telemetry and update calls would fail and log
	// noise, so Claude Code must not make them. `extra` cannot re-enable them.
	env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = "1";
	return env;
}

/** The public values of an `active` `app_backends` row. */
export type BackendEnv = {
	/** `https://<ref>.supabase.co`, from `supabaseProjectUrl`. */
	url: string;
	/** The anon key. RLS limits it, so the browser bundle may hold it. */
	anonKey: string;
};

/**
 * The public values of the row, or null. D18 and WANDIT-283: only an
 * `active` row reaches the VM and the egress list. The builder-turn task and
 * `startSandboxWithoutTurn` share it, so both give the same policy hash.
 */
export function activeBackendEnvOf(
	backend: AppBackendRow | null,
): BackendEnv | null {
	return backend?.status === "active" &&
		backend.ref !== null &&
		backend.anonKey !== null
		? { anonKey: backend.anonKey, url: supabaseProjectUrl(backend.ref) }
		: null;
}

// 60 tries, one per second. Metro is the slowest start: it crawls the
// project before it opens its port.
// LIMIT: a dev server that needs more than 60 s to open its port misses the
// write until its next start. Upgrade: write `.env` before the dev command.
const DEV_PORT_TRIES = 60;

/**
 * Exits 0 when one of the ports accepts a connection, else 1 after the last
 * try. `$1` is the try count, the other arguments are ports. Bash `/dev/tcp`
 * needs no curl in the image. Exported for the spec that runs it on a real port.
 */
export const WAIT_FOR_DEV_PORT_SCRIPT =
	'tries="$1"; shift; for _ in $(seq "$tries"); do for port in "$@"; do (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null && exit 0; done; sleep 1; done; exit 1';

/**
 * Writes the Supabase names to `<workspaceDir>/.env`; Vite and Metro reload it.
 * An equal file stays as it is. On a dev port timeout it still writes the file,
 * then throws so the caller logs a possible lost update.
 */
export async function syncBackendEnvFile(
	sandbox: SandboxReader,
	backend: BackendEnv,
): Promise<void> {
	const path = posix.join(sandbox.workspaceDir, ".env");
	// The web-app template reads VITE_*, the mobile-app template reads
	// EXPO_PUBLIC_*. Both pairs hold the same public values.
	const content = [
		`VITE_SUPABASE_URL=${backend.url}`,
		`VITE_SUPABASE_ANON_KEY=${backend.anonKey}`,
		`EXPO_PUBLIC_SUPABASE_URL=${backend.url}`,
		`EXPO_PUBLIC_SUPABASE_ANON_KEY=${backend.anonKey}`,
		"",
	].join("\n");
	const current = await sandbox.readFile(path);
	// Each write restarts Vite and reloads the preview, so an equal file stays.
	if (current !== null && new TextDecoder().decode(current) === content) {
		return;
	}
	// A dev server reads `.env` at start, but it watches the file only when
	// its port answers. A write between the two is lost until the next start.
	// A sandbox runs one dev server, so the first template port that answers
	// is its port.
	const wait = await sandbox.exec(
		"bash",
		[
			"-c",
			WAIT_FOR_DEV_PORT_SCRIPT,
			"wait-for-dev-port",
			String(DEV_PORT_TRIES),
			...new Set(
				Object.values(TEMPLATE_PROFILES).map((profile) =>
					String(profile.devPort),
				),
			),
		],
		// 10 s more than the tries, for the vendor command round trip.
		{ timeoutMs: (DEV_PORT_TRIES + 10) * 1000 },
	);
	// A dev server that is down reads the file at its next start, so the
	// write goes on. The throw lets the caller log a possible lost update.
	await sandbox.writeFiles([{ content, path }]);
	if (wait.exitCode !== 0) {
		throw new Error(
			`No dev port answered in ${DEV_PORT_TRIES} s; .env is written, a running dev server may miss it`,
		);
	}
}
