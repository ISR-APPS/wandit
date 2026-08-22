// The pure queue model moved to @wandit/preview-editor (target-comments) so
// the native page editor shares it; only the React hook stays app-side.

import {
	pruneMissingTargetComments,
	removeTargetCommentEntry,
	TARGET_COMMENT_LIMIT,
	type TargetCommentEntry,
	type TargetCommentPruneResult,
	targetCommentPins,
	upsertTargetCommentEntry,
} from "@wandit/preview-editor/target-comments";
import { useCallback, useMemo, useRef, useState } from "react";

export {
	pruneMissingTargetComments,
	removeTargetCommentEntry,
	sanitizeTargetCommentEntry,
	TARGET_COMMENT_LIMIT,
	TARGET_COMMENT_MAX_LENGTH,
	type TargetCommentEntry,
	type TargetCommentPin,
	type TargetCommentPruneResult,
	targetCommentPins,
	targetCommentsAfterHistoricalPreview,
	targetCommentsAfterVersionChange,
	upsertTargetCommentEntry,
} from "@wandit/preview-editor/target-comments";

export type TargetCommentsState = {
	targetComments: TargetCommentEntry[];
	targetCommentPins: ReturnType<typeof targetCommentPins>;
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
