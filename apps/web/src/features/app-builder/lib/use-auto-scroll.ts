/**
 * Keeps the end of a scroll list in view while its content grows, and keeps
 * the read message in place when an older chat page goes in above it.
 * chat-pane.tsx calls it for the message list, and activity-panel.tsx calls
 * it for the step list of the details panel. Uses a ResizeObserver and the
 * scroll event of the list.
 */

import {
	type RefObject,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
} from "react";

/** A list end at most this far below the view still counts as "at the end" (px). */
const NEAR_BOTTOM_PX = 120;

/**
 * Keeps the end of the list in view while content grows: new messages,
 * streamed text, new feed rows, and a tray that shrinks the list. A scroll
 * up stops the follow, so the user can read. A new send starts it again.
 * Returns the call to make before an older page loads. The list then keeps
 * the read message in place when the page goes in above it.
 */
export function useAutoScroll(
	listRef: RefObject<HTMLDivElement | null>,
	contentRef: RefObject<HTMLDivElement | null>,
	/** True while a turn runs; a change to true jumps to the end. */
	isSending: boolean,
	/** True while an older chat page loads; its end puts the saved position back. */
	isLoadingOlder = false,
): () => void {
	// True while the list follows new content. The scroll handler and the
	// send effect set it.
	const isFollowingRef = useRef(true);
	// Distance in px from the scroll position to the end of the content when
	// an older page was asked for. Null while no older page loads.
	const distanceFromEndRef = useRef<number | null>(null);

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

	// The older page renders in the same commit that ends the load. A layout
	// effect puts the position back before the browser paints the jump.
	// LIMIT: text that streams in during the load moves the view by its
	// height. Upgrade: anchor on the first message node instead of the end.
	useLayoutEffect(() => {
		const list = listRef.current;
		const distanceFromEnd = distanceFromEndRef.current;
		if (isLoadingOlder || !list || distanceFromEnd === null) return;
		distanceFromEndRef.current = null;
		list.scrollTop = list.scrollHeight - distanceFromEnd;
	}, [isLoadingOlder, listRef]);

	return useCallback(() => {
		const list = listRef.current;
		if (!list) return;
		// The follow would jump to the end when the older page grows the content.
		isFollowingRef.current = false;
		distanceFromEndRef.current = list.scrollHeight - list.scrollTop;
	}, [listRef]);
}
