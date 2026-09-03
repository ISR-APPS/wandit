// One-shot handoff that tells the workspace to auto-start the first AI reply
// for a freshly created project.
//
// Flow position:
// - Project creation already persists the dashboard prompt server-side as the
//   chat's first user message, then navigates to /p/:projectId.
// - Without this flag the workspace would load that message and sit idle — the
//   user had to retype their prompt to get an answer.
// - useCreateProjectWithPrompt writes the flag right before navigating;
//   the post-auth dashboard also writes it after it auto-creates from a
//   stashed landing prompt. useAiChat consumes it exactly once after
//   history loads and streams the assistant's answer to the already-persisted
//   message.
//
// Gotchas:
// - Keyed by projectId + chatId so a stale flag never auto-runs a different
//   project the user merely deep-links into.
// - consume() removes the entry before reporting success, so React Strict
//   Mode's double effects and duplicate tabs can't start two streams.
const STASH_KEY = "wandit-chat-autostart";

type ChatAutostart = {
	projectId: string;
	chatId: string;
};

export const chatAutostart = {
	stash(value: ChatAutostart): void {
		try {
			window.sessionStorage.setItem(STASH_KEY, JSON.stringify(value));
		} catch {
			// Storage may be unavailable in hardened/private contexts.
		}
	},
	/**
	 * Read-and-clear, but only when the stash targets this exact chat.
	 * Returns true when the caller should kick off the first AI turn.
	 */
	consume(projectId: string, chatId: string): boolean {
		try {
			const raw = window.sessionStorage.getItem(STASH_KEY);
			if (raw === null) return false;
			const value = JSON.parse(raw) as Partial<ChatAutostart>;
			if (value.projectId !== projectId || value.chatId !== chatId) {
				return false;
			}
			window.sessionStorage.removeItem(STASH_KEY);
			return true;
		} catch {
			return false;
		}
	},
};
