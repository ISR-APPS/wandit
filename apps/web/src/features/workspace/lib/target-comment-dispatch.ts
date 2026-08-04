import type { AiChatSelectedTarget } from "@wandit/contracts";

import {
	sanitizeTargetCommentEntry,
	TARGET_COMMENT_LIMIT,
	TARGET_COMMENT_MAX_LENGTH,
	type TargetCommentEntry,
} from "./use-target-comments";

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
