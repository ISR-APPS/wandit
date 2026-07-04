// One-shot stash for the prompt a signed-out visitor typed before auth.
// The prompt flow writes it before opening the auth modal; after sign-in
// it is consumed exactly once by the dashboard prompt box.
const STASH_KEY = "wandit-prompt-stash";

export const promptStash = {
	stash(prompt: string): void {
		try {
			window.sessionStorage.setItem(STASH_KEY, prompt);
		} catch {
			// Storage may be unavailable in hardened/private contexts.
		}
	},
	consume(): string | null {
		try {
			const value = window.sessionStorage.getItem(STASH_KEY);
			if (value !== null) window.sessionStorage.removeItem(STASH_KEY);
			return value;
		} catch {
			return null;
		}
	},
};
