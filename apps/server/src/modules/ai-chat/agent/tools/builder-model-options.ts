import type { env } from "@wandit/env/server";

// The composer's dev-only builder picker sends a SLUG (composer
// options.builderModel); this allow-list maps slugs to gateway model ids.
// Unknown or absent values resolve to undefined so the env default applies —
// an arbitrary client string can never reach the gateway as a model id.
export const BUILDER_MODEL_BY_OPTION: Record<string, string> = {
	"gemini-3-1-pro": "google/gemini-3.1-pro-preview",
	"gemini-3-5-flash": "google/gemini-3.5-flash",
	"gemini-3-5-flash-lite": "google/gemini-3.5-flash-lite",
	"gemini-3-6-flash": "google/gemini-3.6-flash",
	"gpt-5-6-luna": "openai/gpt-5.6-luna",
	"gpt-5-6-sol": "openai/gpt-5.6-sol",
	"grok-4-5": "xai/grok-4.5",
	"kimi-k2-7-code": "moonshotai/kimi-k2.7-code",
	"kimi-k3-fast": "moonshotai/kimi-k3-fast",
	"mimo-v2-5": "xiaomi/mimo-v2.5",
	"minimax-m3": "minimax/minimax-m3",
	"muse-spark-1-1": "meta/muse-spark-1.1",
	"muse-spark-1-2-contributor": "meta/muse-spark-1.2-contributor",
	"sonnet-5": "anthropic/claude-sonnet-5",
};

export function resolveBuilderModelOption(value: unknown): string | undefined {
	return typeof value === "string" ? BUILDER_MODEL_BY_OPTION[value] : undefined;
}

// Composer's reasoning picker (options.builderReasoning). Mirrors the env
// enum; "auto" means no reasoning parameter is sent — the provider picks.
// There is deliberately NO per-model effort forcing anymore: effort comes
// only from this explicit pick or the env fallback.
export const BUILDER_REASONING_OPTIONS = [
	"auto",
	"minimal",
	"low",
	"medium",
	"high",
	"xhigh",
] as const satisfies readonly (typeof env.AI_PAGE_DESIGN_REASONING)[];

export type BuilderReasoningOption = (typeof BUILDER_REASONING_OPTIONS)[number];

export function resolveBuilderReasoningOption(
	value: unknown,
): BuilderReasoningOption | undefined {
	return typeof value === "string" &&
		(BUILDER_REASONING_OPTIONS as readonly string[]).includes(value)
		? (value as BuilderReasoningOption)
		: undefined;
}
