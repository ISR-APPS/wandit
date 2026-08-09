import {
	type ComposerMetadata,
	composerMetadataSchema,
} from "@wandit/contracts";

// One-shot stash for the draft a signed-out visitor prepared before auth.
// Files cannot survive the redirect, but the selected workflow can: the
// dashboard restores it and asks for the Video source image there.
const STASH_KEY = "wandit-prompt-stash";
const STASH_VERSION = 2;

export type StashedPrompt = {
	prompt: string;
	composer?: ComposerMetadata;
};

export const promptStash = {
	stash(prompt: string, composer?: ComposerMetadata): void {
		try {
			window.sessionStorage.setItem(
				STASH_KEY,
				JSON.stringify({
					version: STASH_VERSION,
					prompt,
					composer,
				}),
			);
		} catch {
			// Storage may be unavailable in hardened/private contexts.
		}
	},
	consume(): StashedPrompt | null {
		try {
			const stored = window.sessionStorage.getItem(STASH_KEY);
			if (stored === null) return null;
			window.sessionStorage.removeItem(STASH_KEY);
			try {
				const parsed = JSON.parse(stored) as {
					version?: unknown;
					prompt?: unknown;
					composer?: unknown;
				};
				if (
					parsed.version === STASH_VERSION &&
					typeof parsed.prompt === "string"
				) {
					const composer = composerMetadataSchema.safeParse(parsed.composer);
					return {
						prompt: parsed.prompt,
						composer: composer.success ? composer.data : undefined,
					};
				}
			} catch {
				// A pre-v2 stash is plain text. Preserve it during the rollout.
			}
			return { prompt: stored };
		} catch {
			return null;
		}
	},
};
