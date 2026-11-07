/**
 * Display names for gateway model ids, and the dev model and reasoning pickers.
 * The prompt box, the V1 model indicator, the V2 model menu, and the V2 chat
 * cost line read it.
 * The picker choices persist in localStorage.
 */
const MODEL_LABEL_BY_ID: Readonly<Record<string, string>> = {
	"anthropic/claude-fable-5.1": "Claude Fable 5.1",
	"anthropic/claude-haiku-4-5": "Claude Haiku 4.5",
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

export type BuilderModelOption = {
	gatewayModelId: string;
	id: string;
	label: string;
};

function builderModelOption(
	id: string,
	gatewayModelId: string,
): BuilderModelOption {
	return { gatewayModelId, id, label: getModelLabel(gatewayModelId) };
}

/** "default" sends no builderModel option, so the server uses its own builder model. The dev chip shows "Default". */
export const DEFAULT_BUILDER_MODEL: BuilderModelOption = {
	gatewayModelId: "default",
	id: "default",
	label: "Default",
};

export const BUILDER_MODELS: readonly BuilderModelOption[] = [
	DEFAULT_BUILDER_MODEL,
	builderModelOption("grok-4-5", "xai/grok-4.5"),
	builderModelOption("gemini-3-5-flash", "google/gemini-3.5-flash"),
	builderModelOption("gemini-3-5-flash-lite", "google/gemini-3.5-flash-lite"),
	builderModelOption("gemini-3-6-flash", "google/gemini-3.6-flash"),
	builderModelOption("gemini-3-1-pro", "google/gemini-3.1-pro-preview"),
	builderModelOption("kimi-k2-7-code", "moonshotai/kimi-k2.7-code"),
	builderModelOption("kimi-k3-fast", "moonshotai/kimi-k3-fast"),
	builderModelOption("minimax-m3", "minimax/minimax-m3"),
	builderModelOption("mimo-v2-5", "xiaomi/mimo-v2.5"),
	builderModelOption("gpt-5-6-sol", "openai/gpt-5.6-sol"),
	builderModelOption("gpt-5-6-luna", "openai/gpt-5.6-luna"),
	builderModelOption("sonnet-5", "anthropic/claude-sonnet-5"),
	builderModelOption("muse-spark-1-1", "meta/muse-spark-1.1"),
	builderModelOption(
		"muse-spark-1-2-contributor",
		"meta/muse-spark-1.2-contributor",
	),
];

export const BUILDER_MODEL_STORAGE_KEY = "wandit:dev-builder-model";

/** Friendly model name shared by picker and transcript-derived indicators. */
export function getModelLabel(modelId: string): string {
	const knownLabel = MODEL_LABEL_BY_ID[modelId];
	if (knownLabel) return knownLabel;

	const separatorIndex = modelId.indexOf("/");
	if (separatorIndex < 0) return modelId;

	return modelId.slice(separatorIndex + 1) || modelId;
}

export function getBuilderModelOption(id: string): BuilderModelOption {
	return (
		BUILDER_MODELS.find((model) => model.id === id) ?? DEFAULT_BUILDER_MODEL
	);
}

export function readStoredBuilderModel(fromComposer?: unknown): string {
	let candidate: string | null = null;

	if (typeof fromComposer === "string") {
		candidate = fromComposer;
	} else if (typeof window !== "undefined") {
		try {
			candidate = window.localStorage.getItem(BUILDER_MODEL_STORAGE_KEY);
		} catch {
			candidate = null;
		}
	}

	return BUILDER_MODELS.some((model) => model.id === candidate) && candidate
		? candidate
		: DEFAULT_BUILDER_MODEL.id;
}

export function readStoredBuilderGatewayModel(): string {
	return getBuilderModelOption(readStoredBuilderModel()).gatewayModelId;
}

export type BuilderReasoningOption = {
	id: string;
	label: string;
};

/** "Auto" sends no reasoning parameter — the provider picks its own effort. */
export const DEFAULT_BUILDER_REASONING: BuilderReasoningOption = {
	id: "auto",
	label: "Auto",
};

// Mirrors the server's BUILDER_REASONING_OPTIONS allow-list.
export const BUILDER_REASONING_LEVELS: readonly BuilderReasoningOption[] = [
	DEFAULT_BUILDER_REASONING,
	{ id: "minimal", label: "Minimal" },
	{ id: "low", label: "Low" },
	{ id: "medium", label: "Medium" },
	{ id: "high", label: "High" },
	{ id: "xhigh", label: "XHigh" },
];

export const BUILDER_REASONING_STORAGE_KEY = "wandit:dev-builder-reasoning";

export function getBuilderReasoningOption(id: string): BuilderReasoningOption {
	return (
		BUILDER_REASONING_LEVELS.find((level) => level.id === id) ??
		DEFAULT_BUILDER_REASONING
	);
}

export function readStoredBuilderReasoning(fromComposer?: unknown): string {
	let candidate: string | null = null;

	if (typeof fromComposer === "string") {
		candidate = fromComposer;
	} else if (typeof window !== "undefined") {
		try {
			candidate = window.localStorage.getItem(BUILDER_REASONING_STORAGE_KEY);
		} catch {
			candidate = null;
		}
	}

	return BUILDER_REASONING_LEVELS.some((level) => level.id === candidate) &&
		candidate
		? candidate
		: DEFAULT_BUILDER_REASONING.id;
}
