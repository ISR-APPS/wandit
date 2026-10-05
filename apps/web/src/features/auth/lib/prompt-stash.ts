/**
 * One-shot sessionStorage stash for the draft a signed-out visitor writes before auth.
 * The landing create hook and the V1 create hook write it. The dashboard page peeks
 * it, and its autostart reads it after sign-in and can write it back as a prefill.
 * The V1 and V2 create hooks, the auth modal, the landing page (auth error), and
 * routes/auth.magic-link.tsx claim it.
 * The caller decides at stash time if the draft may auto-create (and charge).
 */

import {
	type ComposerMetadata,
	composerMetadataSchema,
	type TargetPlatform,
	targetPlatformSchema,
} from "@wandit/contracts";
import { z } from "zod";

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
	/**
	 * App type the visitor picked in the landing hero. Undefined for a draft
	 * without a pick; the dashboard then keeps its default.
	 */
	targetPlatform?: TargetPlatform;
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

// The stored stash as JSON. Each `.catch` turns a bad field into the value
// that never grants the right to charge credits.
const storedStashSchema = z.object({
	version: z.number().optional().catch(undefined),
	prompt: z.string(),
	// Parsed below with composerMetadataSchema, so a broken composer keeps the prefill.
	composer: z.unknown().optional(),
	autostart: z.boolean().catch(false),
	stashedAt: z.number().catch(0),
	// An unknown platform falls back to the dashboard default.
	targetPlatform: targetPlatformSchema.optional().catch(undefined),
});

// Reads one stored stash value. sessionStorage is untrusted input: a value
// from another app version or a hostile write parses to a safe draft or null.
function parseStash(stored: string): StashedPrompt | null {
	let json: unknown;
	try {
		json = JSON.parse(stored);
	} catch {
		// A pre-v2 stash is plain text. Preserve it as prefill during rollout.
		return { prompt: stored, autostart: false, stashedAt: 0 };
	}
	const record = storedStashSchema.safeParse(json);
	if (!record.success) return null;
	const { data } = record;
	const composer = composerMetadataSchema.safeParse(data.composer);
	const current = data.version === STASH_VERSION;
	// A composer that no longer parses means the draft the visitor
	// priced is not the draft that would be billed: prefill only.
	const composerIntact = data.composer === undefined || composer.success;
	return {
		prompt: data.prompt,
		composer: composer.success ? composer.data : undefined,
		// A stash written by another app version keeps its text as a
		// prefill but never keeps the right to charge credits.
		autostart: current && composerIntact && data.autostart,
		stashedAt: current ? data.stashedAt : 0,
		targetPlatform: data.targetPlatform,
	};
}

export const promptStash = {
	/**
	 * Writes the draft. `opts.autostart` is the charge decision of the caller.
	 * `opts.targetPlatform` is the app type of the landing hero.
	 */
	stash(
		prompt: string,
		composer?: ComposerMetadata,
		opts?: { autostart?: boolean; targetPlatform?: TargetPlatform },
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
					targetPlatform: opts?.targetPlatform,
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
			return parseStash(stored);
		} catch {
			return null;
		}
	},
	/**
	 * Reads the draft without removing it. The dashboard calls it on its
	 * first render, so the create hook has the stashed app type before the
	 * autostart runs.
	 */
	peek(): StashedPrompt | null {
		try {
			const stored = window.sessionStorage.getItem(STASH_KEY);
			return stored === null ? null : parseStash(stored);
		} catch {
			// Storage may be unavailable in hardened/private contexts.
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
