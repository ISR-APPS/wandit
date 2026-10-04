/**
 * Keeps the end of a scroll list in view while its content grows.
 * chat-pane.tsx calls it for the message list, and activity-panel.tsx calls
 * it for the step list of the details panel. Uses a ResizeObserver and the
 * scroll event of the list.
 */

import { type RefObject, useEffect, useRef } from "react";

/** A list end at most this far below the view still counts as "at the end" (px). */
const NEAR_BOTTOM_PX = 120;

/**
 * Keeps the end of the list in view while content grows: new messages,
 * streamed text, new feed rows, and a tray that shrinks the list. A scroll
 * up stops the follow, so the user can read. A new send starts it again.
 */
export function useAutoScroll(
	listRef: RefObject<HTMLDivElement | null>,
	contentRef: RefObject<HTMLDivElement | null>,
	/** True while a turn runs; a change to true jumps to the end. */
	isSending: boolean,
) {
	// True while the list follows new content. The scroll handler and the
	// send effect set it.
	const isFollowingRef = useRef(true);

	useEffect(() => {
		const list = listRef.current;
		const content = contentRef.current;
		if (!list || !content) return;
		let lastScrollTop = list.scrollTop;
		const onScroll = () => {
			const distance = list.scrollHeight - list.scrollTop - list.clientHeight;
			// A move up means the user reads, also near the end. A follow jump
			// moves down, and at most 1 px from the end counts as the end.
			isFollowingRef.current =
				distance <= 1 ||
				(list.scrollTop >= lastScrollTop && distance <= NEAR_BOTTOM_PX);
			lastScrollTop = list.scrollTop;
		};
		const follow = () => {
			if (isFollowingRef.current) list.scrollTop = list.scrollHeight;
		};
		follow();
		list.addEventListener("scroll", onScroll, { passive: true });
		// The content grows while text streams; the list shrinks when the tray opens.
		const observer = new ResizeObserver(follow);
		observer.observe(content);
		observer.observe(list);
		return () => {
			list.removeEventListener("scroll", onScroll);
			observer.disconnect();
		};
	}, [listRef, contentRef]);

	// A send shows its bubble and the working row, also after a scroll up.
	useEffect(() => {
		const list = listRef.current;
		if (!isSending || !list) return;
		isFollowingRef.current = true;
		list.scrollTop = list.scrollHeight;
	}, [isSending, listRef]);
}
