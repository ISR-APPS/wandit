import type { ComposerMetadata } from "@wandit/contracts";

export type ChatAutostartEntry = {
	projectId: string;
	chatId: string;
	composer?: ComposerMetadata;
};

// Project creation persists the first user message but does not start its AI
// reply. Keep this handoff in memory so the destination chat can continue the
// existing message once, without appending the prompt a second time.
const pendingEntries = new Map<string, ChatAutostartEntry>();

export const chatAutostart = {
	stash(entry: ChatAutostartEntry): void {
		pendingEntries.set(entryKey(entry.projectId, entry.chatId), entry);
	},

	consume(projectId: string, chatId: string): ChatAutostartEntry | undefined {
		const key = entryKey(projectId, chatId);
		const entry = pendingEntries.get(key);
		if (!entry) return undefined;

		pendingEntries.delete(key);
		return entry;
	},
};

function entryKey(projectId: string, chatId: string) {
	return `${projectId}:${chatId}`;
}
