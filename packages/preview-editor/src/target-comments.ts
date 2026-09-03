// Pure target-comment model shared by the web iframe host and the native
// WebView host: the queue entries pinned on preview elements, their clamps,
// and the exact batch message composed for the AI send (numbered body +
// ordered wids + display snapshots).

import {
	type AiChatSelectedTarget,
	aiChatSelectedTargetSchema,
} from "@wandit/contracts";

export const TARGET_COMMENT_LIMIT = 10;
export const TARGET_COMMENT_MAX_LENGTH = 500;
const TARGET_COMMENT_TAG_MAX_LENGTH = 32;
const TARGET_COMMENT_EXCERPT_MAX_LENGTH = 160;

export type TargetCommentEntry = AiChatSelectedTarget & {
	comment: string;
};

/** Clamp a queue entry to the chat metadata contract, dropping invalid targets. */
export function sanitizeTargetCommentEntry(
	entry: TargetCommentEntry,
): TargetCommentEntry | null {
	if (
		typeof entry.tag !== "string" ||
		typeof entry.comment !== "string" ||
		(entry.excerpt !== null && typeof entry.excerpt !== "string")
	) {
		return null;
	}

	const target = aiChatSelectedTargetSchema.safeParse({
		wid: entry.wid,
		tag: entry.tag.slice(0, TARGET_COMMENT_TAG_MAX_LENGTH),
		excerpt: entry.excerpt?.slice(0, TARGET_COMMENT_EXCERPT_MAX_LENGTH) ?? null,
	});
	if (!target.success) return null;

	return {
		...target.data,
		comment: entry.comment.slice(0, TARGET_COMMENT_MAX_LENGTH),
	};
}

export type TargetCommentPin = {
	wid: string;
	number: number;
};

export type TargetCommentPruneResult = {
	comments: TargetCommentEntry[];
	removedCount: number;
};

/** Add a target at the end or replace it in place so its number stays stable. */
export function upsertTargetCommentEntry(
	comments: TargetCommentEntry[],
	entry: TargetCommentEntry,
): TargetCommentEntry[] {
	const boundedEntry = {
		...entry,
		comment: entry.comment.slice(0, TARGET_COMMENT_MAX_LENGTH),
	};
	const index = comments.findIndex(({ wid }) => wid === entry.wid);
	if (index === -1) {
		return comments.length >= TARGET_COMMENT_LIMIT
			? comments
			: [...comments, boundedEntry];
	}
	if (
		comments[index]?.tag === boundedEntry.tag &&
		comments[index]?.excerpt === boundedEntry.excerpt &&
		comments[index]?.comment === boundedEntry.comment
	) {
		return comments;
	}
	const next = [...comments];
	next[index] = boundedEntry;
	return next;
}

export function removeTargetCommentEntry(
	comments: TargetCommentEntry[],
	wid: string,
): TargetCommentEntry[] {
	const index = comments.findIndex((entry) => entry.wid === wid);
	if (index === -1) return comments;
	return [...comments.slice(0, index), ...comments.slice(index + 1)];
}

/** Keep only targets confirmed to exist in the currently rendered version. */
export function pruneMissingTargetComments(
	comments: TargetCommentEntry[],
	validWids: ReadonlySet<string>,
): TargetCommentPruneResult {
	const next = comments.filter(({ wid }) => validWids.has(wid));
	return {
		comments: next.length === comments.length ? comments : next,
		removedCount: comments.length - next.length,
	};
}

export function targetCommentPins(
	comments: readonly TargetCommentEntry[],
): TargetCommentPin[] {
	return comments.map(({ wid }, index) => ({ wid, number: index + 1 }));
}

/** Own saves preserve wid-bound comments; every foreign version replaces them. */
export function targetCommentsAfterVersionChange(
	comments: TargetCommentEntry[],
	isOwnVersion: boolean,
): TargetCommentEntry[] {
	return isOwnVersion ? comments : [];
}

export function targetCommentsAfterHistoricalPreview(
	comments: TargetCommentEntry[],
	isPreviewingHistorical: boolean,
): TargetCommentEntry[] {
	return isPreviewingHistorical ? [] : comments;
}

// ── Batch send composition ──────────────────────────────────────────────────

/**
 * The exact AI-send payload: `1. …\n2. …` body with no preamble, the ordered
 * agent-facing wid array, and the display snapshots persisted on the user
 * message for target chips. Null when the queue is empty/overfull or any
 * entry fails its clamp.
 */
export function buildTargetCommentMessage(
	comments: readonly TargetCommentEntry[],
): {
	body: string;
	selectedWids: string[];
	selectedTargets: AiChatSelectedTarget[];
} | null {
	if (comments.length === 0 || comments.length > TARGET_COMMENT_LIMIT)
		return null;

	const normalized = comments.flatMap((entry) => {
		const sanitized = sanitizeTargetCommentEntry(entry);
		return sanitized
			? [{ ...sanitized, comment: sanitized.comment.trim() }]
			: [];
	});
	if (
		normalized.length === 0 ||
		normalized.some(
			(entry) =>
				entry.comment.length === 0 ||
				entry.comment.length > TARGET_COMMENT_MAX_LENGTH,
		)
	) {
		return null;
	}

	return {
		body: normalized
			.map((entry, index) => `${index + 1}. ${entry.comment}`)
			.join("\n"),
		selectedWids: normalized.map((entry) => entry.wid),
		selectedTargets: normalized.map(({ wid, tag, excerpt }) => ({
			wid,
			tag,
			excerpt,
		})),
	};
}

export type TargetCommentDispatchResult = "sent" | "blocked" | "failed";

type TargetCommentSend = (
	text: string,
	options: {
		selectedWids: string[];
		selectedTargets: AiChatSelectedTarget[];
	},
) => Promise<boolean>;

type TargetCommentDispatch = {
	comments: readonly TargetCommentEntry[];
	begin: () => boolean;
	end: () => void;
	save: () => Promise<"saved" | "noop" | "failed">;
	send: TargetCommentSend;
	onSendFailure: () => void;
	onSuccess: () => void;
};

/** Shared immediate/batch path: freeze → drain manual save → send → unfreeze. */
export async function dispatchTargetComments({
	comments,
	begin,
	end,
	save,
	send,
	onSendFailure,
	onSuccess,
}: TargetCommentDispatch): Promise<TargetCommentDispatchResult> {
	const message = buildTargetCommentMessage(comments);
	if (!message || !begin()) return "blocked";

	try {
		if ((await save()) === "failed") return "failed";

		let sent = false;
		try {
			sent = await send(message.body, {
				selectedWids: message.selectedWids,
				selectedTargets: message.selectedTargets,
			});
		} catch {
			sent = false;
		}

		if (!sent) {
			onSendFailure();
			return "failed";
		}

		onSuccess();
		return "sent";
	} finally {
		end();
	}
}
