// The index of the practice panel that the visitor reads now. PracticesSection calls it.
// It reads the window scroll through useSyncExternalStore, so it needs no effect.
// The server page and the first paint show folder 0 as current, the same as the top of the section.
import { type RefObject, useCallback, useSyncExternalStore } from "react";
import { subscribeToScroll } from "../lib/scroll-store";

/** A panel is current when its top edge has passed 45% of the screen height. */
const READING_LINE_SHARE = 0.45;

function readServerIndex(): number {
	return 0;
}

/** The index of the last `[data-practice-panel]` under `panelsRef` whose top is above the reading line. 0 before the first one. */
export function useActivePractice(
	panelsRef: RefObject<HTMLElement | null>,
): number {
	const readIndex = useCallback(() => {
		const container = panelsRef.current;
		if (container === null) {
			return 0;
		}
		const readingLine = window.innerHeight * READING_LINE_SHARE;
		let current = 0;
		container
			.querySelectorAll("[data-practice-panel]")
			.forEach((panel, index) => {
				if (panel.getBoundingClientRect().top <= readingLine) {
					current = index;
				}
			});
		return current;
	}, [panelsRef]);
	return useSyncExternalStore(subscribeToScroll, readIndex, readServerIndex);
}
