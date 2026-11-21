/**
 * Display names for gateway model ids.
 * The V1 model indicator, the V2 model menu, and the V2 chat cost line read it.
 */
const MODEL_LABEL_BY_ID: Readonly<Record<string, string>> = {
	"anthropic/claude-fable-5.1": "Claude Fable 5.1",
	"anthropic/claude-haiku-4-5": "Claude Haiku 4.5",
	"anthropic/claude-haiku-5.5": "Claude Haiku 5.5",
	"anthropic/claude-opus-5": "Claude Opus 5",
	"anthropic/claude-opus-5-fast": "Claude Opus 5 Fast",
	"anthropic/claude-opus-5.5": "Claude Opus 5.5",
	"anthropic/claude-opus-5.5-fast": "Claude Opus 5.5 Fast",
	"anthropic/claude-sonnet-5": "Claude Sonnet 5",
	"deepseek/deepseek-v4.1-flash-1017": "DeepSeek V4.1 Flash",
	"deepseek/deepseek-v4.1-flash-1017-fast": "DeepSeek V4.1 Flash Fast",
	"google/gemini-3.1-pro-preview": "Gemini 3.1 Pro",
	"google/gemini-3.5-flash": "Gemini 3.5 Flash",
	"google/gemini-3.5-flash-lite": "Gemini 3.5 Flash Lite",
	"google/gemini-3.6-flash": "Gemini 3.6 Flash",
	"google/gemini-4-argon": "Gemini 4 Argon",
	"google/gemini-4-hydrogen": "Gemini 4 Hydrogen",
	"google/gemini-4-neon": "Gemini 4 Neon",
	"meta/muse-spark-1.1": "Muse Spark 1.1",
	"meta/muse-spark-1.2-contributor": "Muse Spark 1.2 Contributor",
	"minimax/minimax-m3": "MiniMax M3",
	"moonshotai/kimi-k2.7-code": "Kimi K2.7 Code",
	"moonshotai/kimi-k3-fast": "Kimi K3 Fast",
	"openai/gpt-5.6-luna": "GPT-5.6 Luna",
	"openai/gpt-5.6-sol": "GPT-5.6 Sol",
	"openai/gpt-5.6-terra": "GPT-5.6 Terra",
	"openai/gpt-6.1-terra": "GPT-6.1 Terra",
	"openai/gpt-6.1-terra-fast": "GPT-6.1 Terra Fast",
	"paperinstruments/ultramarine-1-flash": "Ultramarine 1 Flash",
	"xai/grok-4.5": "Grok 4.5",
	"xiaomi/mimo-v2.5": "MiMo v2.5",
	"zai/glm-5.3": "GLM 5.3",
	"zai/glm-5.3-fast": "GLM 5.3 Fast",
	"zai/glm-5.3-flash": "GLM 5.3 Flash",
};

/** Friendly model name shared by picker and transcript-derived indicators. */
export function getModelLabel(modelId: string): string {
	const knownLabel = MODEL_LABEL_BY_ID[modelId];
	if (knownLabel) return knownLabel;

	const separatorIndex = modelId.indexOf("/");
	if (separatorIndex < 0) return modelId;

	return modelId.slice(separatorIndex + 1) || modelId;
}
