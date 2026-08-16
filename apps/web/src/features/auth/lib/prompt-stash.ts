import {
	type ComposerMetadata,
	composerMetadataSchema,
} from "@wandit/contracts";

// One-shot stash for the draft a signed-out visitor prepared before auth.
// Files cannot survive the redirect, but the selected workflow can: the
// dashboard restores it. Whether the draft may auto-create (and charge) after
// auth is decided by the projects feature at stash time and recorded on the
// entry — this module never re-derives generation domain rules.
const STASH_KEY = "wandit-prompt-stash";
const STASH_VERSION = 3;

// A stash is only allowed to auto-create a project (a paid action) shortly
// after it was written. Anything older — an abandoned Google consent screen,
// a tab picked up hours later, a draft left behind before a sign-out —
// downgrades to a harmless composer prefill.
export const AUTOSTART_TTL_MS = 30 * 60_000;

export type StashedPrompt = {
	prompt: string;
	composer?: ComposerMetadata;
	/** Recorded at stash time by the caller; never assumed for older stashes. */
	autostart: boolean;
	/** Epoch ms of the stash write; 0 for legacy/foreign payloads. */
	stashedAt: number;
};

/**
 * True when the post-auth dashboard may create the project and start
 * generation without another click. Requires the caller-recorded autostart
 * flag AND a fresh stash — stale drafts restore as prefill only, so a leaked
 * stash can never silently charge credits later.
 */
export function canAutostartStashedPrompt(
	draft: StashedPrompt,
	now: number = Date.now(),
): boolean {
	if (!draft.autostart) return false;
	if (draft.prompt.trim().length === 0) return false;
	// A future-dated or non-finite timestamp (clock skew, hostile write) must
	// not pass as "fresh" — the age check only holds for a sane past instant.
	if (!Number.isFinite(draft.stashedAt) || draft.stashedAt <= 0) return false;
	if (draft.stashedAt > now) return false;
	return now - draft.stashedAt <= AUTOSTART_TTL_MS;
}

// Bumped by clear(); a caller that consumed a draft and later wants to put it
// back can tell that a sign-out happened in between and must not resurrect it.
let clearGeneration = 0;

export const promptStash = {
	stash(
		prompt: string,
		composer?: ComposerMetadata,
		opts?: { autostart?: boolean },
	): void {
		try {
			window.sessionStorage.setItem(
				STASH_KEY,
				JSON.stringify({
					version: STASH_VERSION,
					prompt,
					composer,
					autostart: opts?.autostart === true,
					stashedAt: Date.now(),
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
				const parsed: unknown = JSON.parse(stored);
				if (parsed === null || typeof parsed !== "object") return null;
				const record = parsed as {
					version?: unknown;
					prompt?: unknown;
					composer?: unknown;
					autostart?: unknown;
					stashedAt?: unknown;
				};
				if (typeof record.prompt !== "string") return null;
				const composer = composerMetadataSchema.safeParse(record.composer);
				const current = record.version === STASH_VERSION;
				// A composer that no longer parses means the draft the visitor
				// priced is not the draft that would be billed: prefill only.
				const composerIntact =
					record.composer === undefined || composer.success;
				return {
					prompt: record.prompt,
					composer: composer.success ? composer.data : undefined,
					// A stash written by another app version keeps its text as a
					// prefill but never keeps the right to charge credits.
					autostart: current && composerIntact && record.autostart === true,
					stashedAt:
						current && typeof record.stashedAt === "number"
							? record.stashedAt
							: 0,
				};
			} catch {
				// A pre-v2 stash is plain text. Preserve it as prefill during rollout.
			}
			return { prompt: stored, autostart: false, stashedAt: 0 };
		} catch {
			return null;
		}
	},
	/** Drop the stash without reading it (e.g. on sign-out). */
	clear(): void {
		clearGeneration += 1;
		try {
			window.sessionStorage.removeItem(STASH_KEY);
		} catch {
			// Storage may be unavailable in hardened/private contexts.
		}
	},
	/** Compare before a deferred re-stash: a change means clear() ran since. */
	generation(): number {
		return clearGeneration;
	},
};
