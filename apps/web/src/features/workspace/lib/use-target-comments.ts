import {
	type AiChatSelectedTarget,
	aiChatSelectedTargetSchema,
} from "@wandit/contracts";
import { useCallback, useMemo, useRef, useState } from "react";

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

export type TargetCommentsState = {
	targetComments: TargetCommentEntry[];
	targetCommentPins: TargetCommentPin[];
	isTargetCommentQueueFull: boolean;
	/** False only when a new wid is rejected because the queue is full. */
	upsertTargetComment: (entry: TargetCommentEntry) => boolean;
	removeTargetComment: (wid: string) => void;
	clearTargetComments: () => void;
	/** Prune against a complete wid set for the rendered version. */
	pruneTargetComments: (validWids: Iterable<string>) => number;
	/** Prune one target known to have been removed by a live manual edit. */
	pruneTargetComment: (wid: string) => boolean;
	prunedTargetCommentCount: number;
	acknowledgeTargetCommentsPruned: () => void;
};

export function useTargetComments(): TargetCommentsState {
	const [targetComments, setTargetComments] = useState<TargetCommentEntry[]>(
		[],
	);
	const [prunedTargetCommentCount, setPrunedTargetCommentCount] = useState(0);
	const targetCommentsRef = useRef(targetComments);
	targetCommentsRef.current = targetComments;

	const commit = useCallback((next: TargetCommentEntry[]) => {
		if (next === targetCommentsRef.current) return;
		targetCommentsRef.current = next;
		setTargetComments(next);
	}, []);

	const upsertTargetComment = useCallback(
		(entry: TargetCommentEntry) => {
			const current = targetCommentsRef.current;
			const exists = current.some(({ wid }) => wid === entry.wid);
			if (!exists && current.length >= TARGET_COMMENT_LIMIT) return false;
			commit(upsertTargetCommentEntry(current, entry));
			return true;
		},
		[commit],
	);

	const removeTargetComment = useCallback(
		(wid: string) => {
			commit(removeTargetCommentEntry(targetCommentsRef.current, wid));
		},
		[commit],
	);

	const clearTargetComments = useCallback(() => {
		commit([]);
		setPrunedTargetCommentCount(0);
	}, [commit]);

	const recordPrune = useCallback(
		(result: TargetCommentPruneResult) => {
			if (result.removedCount === 0) return 0;
			commit(result.comments);
			setPrunedTargetCommentCount((count) => count + result.removedCount);
			return result.removedCount;
		},
		[commit],
	);

	const pruneTargetComments = useCallback(
		(validWids: Iterable<string>) =>
			recordPrune(
				pruneMissingTargetComments(
					targetCommentsRef.current,
					new Set(validWids),
				),
			),
		[recordPrune],
	);

	const pruneTargetComment = useCallback(
		(wid: string) => {
			const current = targetCommentsRef.current;
			const next = removeTargetCommentEntry(current, wid);
			return (
				recordPrune({
					comments: next,
					removedCount: next === current ? 0 : 1,
				}) > 0
			);
		},
		[recordPrune],
	);

	const acknowledgeTargetCommentsPruned = useCallback(
		() => setPrunedTargetCommentCount(0),
		[],
	);

	const pins = useMemo(
		() => targetCommentPins(targetComments),
		[targetComments],
	);

	return useMemo(
		() => ({
			targetComments,
			targetCommentPins: pins,
			isTargetCommentQueueFull: targetComments.length >= TARGET_COMMENT_LIMIT,
			upsertTargetComment,
			removeTargetComment,
			clearTargetComments,
			pruneTargetComments,
			pruneTargetComment,
			prunedTargetCommentCount,
			acknowledgeTargetCommentsPruned,
		}),
		[
			targetComments,
			pins,
			upsertTargetComment,
			removeTargetComment,
			clearTargetComments,
			pruneTargetComments,
			pruneTargetComment,
			prunedTargetCommentCount,
			acknowledgeTargetCommentsPruned,
		],
	);
}
