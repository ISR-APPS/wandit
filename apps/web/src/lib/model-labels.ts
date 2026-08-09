const MODEL_LABEL_BY_ID: Readonly<Record<string, string>> = {
	"anthropic/claude-sonnet-5": "Claude Sonnet 5",
	"google/gemini-3.1-pro-preview": "Gemini 3.1 Pro",
	"google/gemini-3.5-flash": "Gemini 3.5 Flash",
	"google/gemini-3.5-flash-lite": "Gemini 3.5 Flash Lite",
	"google/gemini-3.6-flash": "Gemini 3.6 Flash",
	"meta/muse-spark-1.1": "Muse Spark 1.1",
	"minimax/minimax-m3": "MiniMax M3",
	"moonshotai/kimi-k3-fast": "Kimi K3 Fast",
	"openai/gpt-5.6-luna": "GPT-5.6 Luna",
	"openai/gpt-5.6-sol": "GPT-5.6 Sol",
	"openai/gpt-5.6-terra": "GPT-5.6 Terra",
	"xai/grok-4.5": "Grok 4.5",
	"xiaomi/mimo-v2.5": "MiMo v2.5",
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

export const DEFAULT_BUILDER_MODEL: BuilderModelOption = {
	gatewayModelId: "default",
	id: "default",
	label: "Builder: default",
};

export const BUILDER_MODELS: readonly BuilderModelOption[] = [
	DEFAULT_BUILDER_MODEL,
	builderModelOption("grok-4-5", "xai/grok-4.5"),
	builderModelOption("gemini-3-5-flash", "google/gemini-3.5-flash"),
	builderModelOption("gemini-3-5-flash-lite", "google/gemini-3.5-flash-lite"),
	builderModelOption("gemini-3-6-flash", "google/gemini-3.6-flash"),
	builderModelOption("gemini-3-1-pro", "google/gemini-3.1-pro-preview"),
	builderModelOption("kimi-k3-fast", "moonshotai/kimi-k3-fast"),
	builderModelOption("minimax-m3", "minimax/minimax-m3"),
	builderModelOption("mimo-v2-5", "xiaomi/mimo-v2.5"),
	builderModelOption("gpt-5-6-sol", "openai/gpt-5.6-sol"),
	builderModelOption("gpt-5-6-luna", "openai/gpt-5.6-luna"),
	builderModelOption("sonnet-5", "anthropic/claude-sonnet-5"),
	builderModelOption("muse-spark-1-1", "meta/muse-spark-1.1"),
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
