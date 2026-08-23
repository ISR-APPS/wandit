// "Send to Wandit" hands the comment batch from the page view back to the
// chat as one composed message. Same in-memory handoff shape as
// chat-autostart: the page screen stashes, navigates back, and the chat
// screen consumes exactly once on focus. The payload now carries the web's
// full batch format: numbered body + ordered agent-facing wids + the display
// snapshots persisted on the user message (target chips).

import type { AiChatSelectedTarget } from "@wandit/contracts";

export type PageCommentBatch = {
	text: string;
	selectedWids: string[];
	selectedTargets: AiChatSelectedTarget[];
};

const pendingBatches = new Map<string, PageCommentBatch>();

export const pageCommentHandoff = {
	stash(projectId: string, batch: PageCommentBatch): void {
		pendingBatches.set(projectId, batch);
	},

	consume(projectId: string): PageCommentBatch | undefined {
		const batch = pendingBatches.get(projectId);
		if (batch === undefined) return undefined;

		pendingBatches.delete(projectId);
		return batch;
	},
};
