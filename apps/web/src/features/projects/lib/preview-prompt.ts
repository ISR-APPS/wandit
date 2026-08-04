export const PREVIEW_PROMPT_STATE_KEY = "previewPrompt";
export const MAX_PREVIEW_PROMPT_LENGTH = 2_000;

export function normalizePreviewPrompt(value: unknown): string | undefined {
	return typeof value === "string" && value.trim().length > 0
		? value.slice(0, MAX_PREVIEW_PROMPT_LENGTH)
		: undefined;
}

export function getPreviewPromptFromHistoryState(
	state: unknown,
): string | undefined {
	if (typeof state !== "object" || state === null) return undefined;

	return normalizePreviewPrompt(
		(state as Record<string, unknown>)[PREVIEW_PROMPT_STATE_KEY],
	);
}

export function migrateLegacyPreviewPromptUrl(): void {
	if (
		typeof window === "undefined" ||
		window.location.pathname !== "/preview"
	) {
		return;
	}

	const promptlessUrl = new URL(window.location.href);
	const prompt = normalizePreviewPrompt(
		promptlessUrl.searchParams.get("prompt"),
	);
	if (!prompt) return;

	promptlessUrl.searchParams.delete("prompt");
	window.history.replaceState(
		{
			...window.history.state,
			[PREVIEW_PROMPT_STATE_KEY]: prompt,
		},
		"",
		`${promptlessUrl.pathname}${promptlessUrl.search}${promptlessUrl.hash}`,
	);
}
