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
	"kimi-k3-fast": "moonshotai/kimi-k3-fast",
	"muse-spark-1-1": "meta/muse-spark-1.1",
	"sonnet-5": "anthropic/claude-sonnet-5",
};

export function resolveBuilderModelOption(value: unknown): string | undefined {
	return typeof value === "string" ? BUILDER_MODEL_BY_OPTION[value] : undefined;
}
