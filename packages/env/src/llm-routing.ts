// Per-task LLM provider routing vocabulary, shared by the env schema
// (boot-time validation of AI_PROVIDER_OVERRIDES), the server's provider
// seam, and Trigger task configuration assertions. Pure module: no env
// access, no side effects.

/**
 * Every TEXT-model call site names itself with one of these tasks. The
 * override syntax accepts exactly this list; media work (image, video,
 * transcription) stays on the Vercel gateway and is deliberately absent.
 */
export const LLM_TASKS = [
	"chat",
	"marketing",
	"page_build",
	"project_title",
	"prompt_refine",
] as const;

export type LlmTask = (typeof LLM_TASKS)[number];
export type LlmTaskProvider = "openrouter" | "vercel";
export type LlmProviderOverrides = Partial<Record<LlmTask, LlmTaskProvider>>;

/**
 * Names a user could plausibly try that must fail with a "pinned" message
 * instead of the generic unknown-task one: these workflows exist in the
 * product but run on the Vercel gateway unconditionally in this version.
 */
const VERCEL_PINNED_TASKS = new Set([
	"audio",
	"connector",
	"image",
	"lead_scrape",
	"transcription",
	"video",
]);

export type ParsedLlmProviderOverrides = {
	errors: string[];
	overrides: LlmProviderOverrides;
};

/**
 * Parses "task=provider,task=provider" (e.g. "page_build=openrouter").
 * Collects every problem instead of throwing so the env schema can report
 * all of them at boot; entries with problems never land in `overrides`, so
 * a caller running without validation (tests) falls back to AI_PROVIDER for
 * that task rather than routing somewhere unintended.
 */
export function parseLlmProviderOverrides(
	raw: string | undefined,
): ParsedLlmProviderOverrides {
	const errors: string[] = [];
	const overrides: LlmProviderOverrides = {};

	if (!raw || raw.trim().length === 0) {
		return { errors, overrides };
	}

	for (const segment of raw.split(",")) {
		const entry = segment.trim();

		if (entry.length === 0) {
			continue;
		}

		const separatorIndex = entry.indexOf("=");

		if (separatorIndex === -1) {
			errors.push(
				`AI_PROVIDER_OVERRIDES entry "${entry}" must use the task=provider form`,
			);
			continue;
		}

		const task = entry.slice(0, separatorIndex).trim();
		const provider = entry.slice(separatorIndex + 1).trim();

		if (VERCEL_PINNED_TASKS.has(task)) {
			errors.push(
				`AI_PROVIDER_OVERRIDES task "${task}" is pinned to the Vercel gateway in this version`,
			);
			continue;
		}

		if (!isLlmTask(task)) {
			errors.push(
				`AI_PROVIDER_OVERRIDES names unknown task "${task}" (valid tasks: ${LLM_TASKS.join(", ")})`,
			);
			continue;
		}

		if (provider !== "openrouter" && provider !== "vercel") {
			errors.push(
				`AI_PROVIDER_OVERRIDES task "${task}" names unknown provider "${provider}" (valid providers: openrouter, vercel)`,
			);
			continue;
		}

		if (task in overrides) {
			errors.push(`AI_PROVIDER_OVERRIDES names task "${task}" twice`);
			continue;
		}

		overrides[task] = provider;
	}

	return { errors, overrides };
}

function isLlmTask(value: string): value is LlmTask {
	return (LLM_TASKS as readonly string[]).includes(value);
}
