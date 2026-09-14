/**
 * Upstream and provider-key selection for the V2 LLM proxy.
 * `LlmProxyService` calls `upstreamFor` once per request, after the model
 * allow-list check. Pure functions; specs pass a plain env object.
 */

/** Env keys the LLM proxy reads. `env` satisfies it; specs pass a subset. */
export type LlmProxyEnv = {
	AI_GATEWAY_API_KEY?: string | undefined;
	ANTHROPIC_API_KEY?: string | undefined;
	LLM_PROXY_SIGNING_KEY?: string | undefined;
	OPENROUTER_API_KEY?: string | undefined;
	V2_DEFAULT_MODEL?: string | undefined;
	V2_LLM_UPSTREAM_BASE_URL?: string | undefined;
};

/**
 * Nest token that carries the env subset into `LlmProxyService`. The module
 * provides it with `useValue: env`; specs inject a plain object instead.
 */
export const LLM_PROXY_ENV = Symbol.for("app-builder.llm-proxy-env");

// Default upstream when `V2_LLM_UPSTREAM_BASE_URL` is unset.
const ANTHROPIC_UPSTREAM_BASE_URL = "https://api.anthropic.com";
// Vercel AI Gateway host: it bills through the gateway key, not Anthropic's.
const VERCEL_AI_GATEWAY_HOST = "ai-gateway.vercel.sh";
// OpenRouter's own host, for deploys that point the base URL there.
const OPENROUTER_HOST = "openrouter.ai";

/** How the provider key travels on the forwarded request. */
export type LlmUpstreamAuthStyle = "x-api-key" | "bearer";

/** Env values `upstreamFor` can ask for; a 503 names the missing one. */
export type LlmUpstreamKeyEnv =
	| "AI_GATEWAY_API_KEY"
	| "ANTHROPIC_API_KEY"
	| "OPENROUTER_API_KEY";

/** Where a proxied request goes and how it proves itself. */
export type LlmUpstream = {
	// Forward target base; the service appends `/v1/messages` paths.
	baseUrl: string;
	// Provider of the model for the usage row, for example `anthropic`.
	provider: string;
	// Model id to send upstream. On api.anthropic.com it is the id the
	// client sent minus the `anthropic/` routing prefix, so a dated id
	// like `claude-haiku-4-5-20251001` passes through. Every other host is
	// a gateway and gets the normalized allow-list id.
	upstreamModelId: string;
	// The provider key. Never log it, never send it anywhere but upstream.
	apiKey: string;
	authStyle: LlmUpstreamAuthStyle;
};

// Bare Claude ids Claude Code sends after resolving its aliases:
// claude-<family>-<major>[-<minor>][-<yyyymmdd>].
const CLAUDE_BARE_ID =
	/^claude-(?<family>opus|sonnet|haiku)-(?<major>\d+)(?:-(?<minor>\d+))?$/;

/**
 * Maps a bare Anthropic model id to the `anthropic/...` allow-list form.
 * Claude Code resolves its model aliases to dated bare ids like
 * `claude-haiku-4-5-20251001` before it calls the API, so the proxy must
 * normalize before the allow-list check. An id that already contains `/`,
 * or that does not match the claude-<family>-<major>[-<minor>][-<date>]
 * shape, returns unchanged.
 */
export function normalizeInboundModelId(modelId: string): string {
	if (modelId.includes("/")) {
		return modelId;
	}
	// An 8-digit tail is a release date, never a minor version: strip it
	// first so `claude-opus-5-20260401` still reads as opus 5.
	const match = CLAUDE_BARE_ID.exec(modelId.replace(/-\d{8}$/, ""));
	if (match?.groups === undefined) {
		return modelId;
	}
	const { family, major, minor } = match.groups;
	return `anthropic/claude-${family}-${major}${minor === undefined ? "" : `-${minor}`}`;
}

/** `ok: false` names the env value that must be set, for a 503 answer. */
export type LlmUpstreamResult =
	| { ok: true; upstream: LlmUpstream }
	| { ok: false; missingEnv: LlmUpstreamKeyEnv };

/**
 * Picks the base URL, provider key, and auth header for one model id.
 * The gateway host wins over the model prefix: the gateway key signs the
 * request, whatever the model is called. `modelId` is the normalized
 * allow-list id; `inboundModelId` is the id the client sent, which
 * api.anthropic.com forwards as is. Absent when the client named no model
 * and the deploy default applies.
 */
export function upstreamFor(
	modelId: string,
	envLike: LlmProxyEnv,
	inboundModelId?: string,
): LlmUpstreamResult {
	const baseUrl =
		envLike.V2_LLM_UPSTREAM_BASE_URL ?? ANTHROPIC_UPSTREAM_BASE_URL;
	// The env schema validates the URL at boot, so `new URL` cannot throw
	// in production. A spec that passes a bad string fails loudly instead.
	const host = new URL(baseUrl).hostname;
	// `anthropic/x` is an Anthropic model on a gateway; `openrouter/x` is an
	// OpenRouter model. A bare id is Anthropic.
	const provider = modelId.includes("/")
		? modelId.slice(0, modelId.indexOf("/"))
		: "anthropic";

	const keyEnvName: LlmUpstreamKeyEnv =
		host === VERCEL_AI_GATEWAY_HOST
			? "AI_GATEWAY_API_KEY"
			: provider === "openrouter" || host === OPENROUTER_HOST
				? "OPENROUTER_API_KEY"
				: "ANTHROPIC_API_KEY";

	const apiKey = envLike[keyEnvName];
	if (apiKey === undefined) {
		return { ok: false, missingEnv: keyEnvName };
	}

	// api.anthropic.com wants the bare model name and accepts the dated ids
	// Claude Code sends, so the client's own id (minus an `anthropic/`
	// routing prefix) wins over the normalized one there. Gateways bill by
	// the normalized `anthropic/...` id format.
	let upstreamModelId = modelId;
	if (host === "api.anthropic.com") {
		const clientId = inboundModelId ?? modelId;
		upstreamModelId = clientId.startsWith("anthropic/")
			? clientId.slice("anthropic/".length)
			: clientId;
	}

	return {
		ok: true,
		upstream: {
			baseUrl,
			provider,
			upstreamModelId,
			apiKey,
			authStyle: keyEnvName === "ANTHROPIC_API_KEY" ? "x-api-key" : "bearer",
		},
	};
}
