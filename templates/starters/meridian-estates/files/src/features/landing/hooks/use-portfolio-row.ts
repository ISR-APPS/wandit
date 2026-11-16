// The sideways travel of the portfolio row. PortfolioSection calls it with the row and its progress rule.
// On each scroll frame it writes --mer-row-progress (0 to 1) on the rule, and keeps the number of the house
// under the center of the row for the count. `scrollByPanel` moves the row one panel, in the reading direction.
import { type RefObject, useEffect, useState } from "react";

/** What the portfolio controls read: the house in view (0-based) and a one-panel move. */
export type PortfolioRow = {
	/** Index of the house under the center of the row, 0 to `houseCount - 1`. The lead panel shows house 0. */
	activeIndex: number;
	/** Brings the next (1) or the previous (-1) panel to the start edge. The CSS of the row makes it smooth. */
	scrollByPanel: (direction: 1 | -1) => void;
};

/** The house panel under the center of the row, or 0 while the lead panel holds the center. */
function findCenteredHouse(row: HTMLElement, houseCount: number): number {
	const rowBox = row.getBoundingClientRect();
	const centerX = rowBox.left + rowBox.width / 2;
	// The first child is the lead panel. Screen boxes work the same in a left-to-right and a right-to-left page.
	const housePanels = Array.from(row.children).slice(1);
	const centered = housePanels.findIndex((panel) => {
		const box = panel.getBoundingClientRect();
		return box.left <= centerX && centerX < box.right;
	});
	return Math.min(houseCount - 1, Math.max(0, centered));
}

/** Follows `rowRef` and writes its progress on `ruleRef`. `houseCount` sets the range of `activeIndex`. */
export function usePortfolioRow(
	rowRef: RefObject<HTMLElement | null>,
	ruleRef: RefObject<HTMLElement | null>,
	houseCount: number,
): PortfolioRow {
	const [activeIndex, setActiveIndex] = useState(0);
	// effect: the scroll offset of the row is a browser value. The listener syncs it into the rule and the count.
	useEffect(() => {
		const row = rowRef.current;
		const rule = ruleRef.current;
		if (row === null || rule === null) {
			return;
		}
		let frameRequest = 0;
		const update = () => {
			frameRequest = 0;
			const travel = row.scrollWidth - row.clientWidth;
			// In a right-to-left page scrollLeft runs from 0 to a negative value.
			const progress = travel > 0 ? Math.abs(row.scrollLeft) / travel : 0;
			rule.style.setProperty("--mer-row-progress", progress.toFixed(4));
			setActiveIndex(findCenteredHouse(row, houseCount));
		};
		const schedule = () => {
			if (frameRequest === 0) {
				frameRequest = window.requestAnimationFrame(update);
			}
		};
		update();
		row.addEventListener("scroll", schedule, { passive: true });
		window.addEventListener("resize", schedule);
		return () => {
			row.removeEventListener("scroll", schedule);
			window.removeEventListener("resize", schedule);
			window.cancelAnimationFrame(frameRequest);
		};
	}, [rowRef, ruleRef, houseCount]);

	const scrollByPanel = (direction: 1 | -1) => {
		const row = rowRef.current;
		if (row === null) {
			return;
		}
		// Child 0 is the lead panel, so house n is child n + 1. "Back" from the first house shows the lead panel.
		const targetChild = Math.min(
			houseCount,
			Math.max(0, findCenteredHouse(row, houseCount) + 1 + direction),
		);
		const target = row.children[targetChild];
		if (target === undefined) {
			return;
		}
		const rowBox = row.getBoundingClientRect();
		const targetBox = target.getBoundingClientRect();
		const isRightToLeft = getComputedStyle(row).direction === "rtl";
		// The distance from the start edge of the row to the start edge of the target, in the reading direction.
		const offset = isRightToLeft
			? rowBox.right - targetBox.right
			: targetBox.left - rowBox.left;
		row.scrollBy({ left: isRightToLeft ? -offset : offset });
	};

	return { activeIndex, scrollByPanel };
}
