// Tells ProjectsSection which project article the visitor reads: the last one whose middle passed the 70% line.
// The pinned scene column shows the scene of that article. It reads the scroll position in a requestAnimationFrame.
import { type RefObject, useEffect, useState } from "react";

/**
 * The index of the last `[data-index]` child of `listRef` whose middle is above 70% of the viewport height.
 * 0 on the server, before the first scroll, and above the first article, so the first scene shows with no script.
 */
export function useActiveIndex(listRef: RefObject<HTMLElement | null>): number {
	const [activeIndex, setActiveIndex] = useState(0);
	// effect: the scroll position is a browser value. The hook reads it on scroll and keeps one index in state.
	useEffect(() => {
		const list = listRef.current;
		if (list === null) {
			return;
		}
		const articles = [...list.querySelectorAll("[data-index]")];
		let frame = 0;
		const update = () => {
			frame = 0;
			// 0.7: the scene changes when the middle of an article is in the upper 70% of the screen.
			// At that point its title is fully in view. The middle, not the top: the text sits in the center of a tall box.
			const line = window.innerHeight * 0.7;
			let index = 0;
			articles.forEach((article, position) => {
				const box = article.getBoundingClientRect();
				if (box.top + box.height / 2 < line) {
					index = position;
				}
			});
			setActiveIndex(index);
		};
		const schedule = () => {
			if (frame === 0) {
				frame = window.requestAnimationFrame(update);
			}
		};
		update();
		window.addEventListener("scroll", schedule, { passive: true });
		window.addEventListener("resize", schedule);
		return () => {
			window.removeEventListener("scroll", schedule);
			window.removeEventListener("resize", schedule);
			window.cancelAnimationFrame(frame);
		};
	}, [listRef]);
	return activeIndex;
}
