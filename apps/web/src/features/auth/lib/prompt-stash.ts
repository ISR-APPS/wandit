// One-shot stash for the prompt a signed-out visitor typed before auth.
// The prompt flow writes it before opening the auth modal; after sign-in
// (including a magic-link redirect) it is consumed exactly once.
const STASH_KEY = "wandit-prompt-stash";

export const promptStash = {
	stash(prompt: string): void {
		try {
			window.sessionStorage.setItem(STASH_KEY, prompt);
		} catch {
			// storage unavailable — continuation still runs in-memory
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
