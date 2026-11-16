// The one scroll scene of the home page. The plinths of the window move from their order of arrival to their price order.
// WindowSection calls this hook with its section, its grid, and the price order of the cells.
// The hook writes a transform on each [data-window-cell] child of the grid. It writes three CSS variables on the section.
// It also pins the section: it sets data-pinned, and landing.css then shows the runway under the sticky stage.
// With no script, or with reduced motion, the grid keeps its order of arrival and nothing pins.
import { type RefObject, useEffect } from "react";

/** Share of the remaining distance that one frame covers. It smooths the steps of a mouse wheel. */
const EASE_PER_FRAME = 0.22;
/** The two labels of the sort bar trade ink and grey at 42% of the scene. The trade takes 10% of it. */
const LABEL_SWAP_AT = 0.42;
const LABEL_SWAP_SPAN = 0.1;
/** Share of the pin runway at each end where the plates stand still. A stop near an end then shows a complete grid. */
const PIN_HOLD = 0.12;

/** How the cells share the scene. One time unit is the flight of one cell on a single row. */
type Pace = {
	/** The delay between the starts of two cells. */
	step: number;
	/** The length of the flight of one cell. */
	flight: number;
};

/** One row: the six cells move together. */
const ROW_PACE: Pace = { step: 0.05, flight: 1 };
/** A folded grid: one cell lands before the next one leaves, so two plates never cross. */
const FOLDED_PACE: Pace = { step: 0.62, flight: 0.52 };

/** A slow start and a slow end: the "power1.inOut" curve of the source page. */
function easeInOut(time: number): number {
	return time < 0.5 ? 2 * time * time : 1 - 2 * (1 - time) * (1 - time);
}

/**
 * The order in which the cells leave. It follows each cycle of the permutation from the last slot:
 * a cell lands on the slot that the next cell leaves, so one slot at most is empty at a time.
 * `slotOfCell[i]` is the slot where cell `i` lands. The result gives the turn of each cell.
 */
function turnsOf(slotOfCell: readonly number[]): number[] {
	const turns = new Array<number>(slotOfCell.length).fill(0);
	const isSeen = new Array<boolean>(slotOfCell.length).fill(false);
	let turn = 0;
	for (let start = slotOfCell.length - 1; start >= 0; start -= 1) {
		let cell = start;
		while (!isSeen[cell]) {
			isSeen[cell] = true;
			turns[cell] = turn;
			turn += 1;
			cell = slotOfCell[cell] ?? start;
		}
	}
	return turns;
}

/**
 * Links the sort of the window to the scroll. `slotOfCell[i]` is the slot of cell `i` in the price order.
 * The scene runs both ways: a scroll back to the top puts the cells back in their order of arrival.
 * The section must hold one [data-window-stage] block and one [data-window-runway] block after it.
 */
export function useWindowSort(
	sectionRef: RefObject<HTMLElement | null>,
	gridRef: RefObject<HTMLElement | null>,
	slotOfCell: readonly number[],
) {
	// effect: scroll, ResizeObserver, and requestAnimationFrame are browser APIs. They are the only source of the sort progress.
	useEffect(() => {
		const section = sectionRef.current;
		const grid = gridRef.current;
		const prefersStill = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		const stage = section?.querySelector<HTMLElement>("[data-window-stage]");
		const runway = section?.querySelector<HTMLElement>("[data-window-runway]");
		if (
			section === null ||
			grid === null ||
			stage == null ||
			runway == null ||
			prefersStill
		) {
			return;
		}
		const cells = [...grid.querySelectorAll<HTMLElement>("[data-window-cell]")];
		const turns = turnsOf(slotOfCell);
		let frame = 0;
		let shown = 0;
		// The distance of each cell to its slot in the price order, in px. `measure` fills it.
		let moves: { x: number; y: number }[] = [];
		let isSingleRow = true;
		let isPinned = false;

		const measure = () => {
			// offsetLeft and offsetTop ignore the transform, so the cells can be in flight here.
			const slots = cells.map((cell) => ({
				x: cell.offsetLeft,
				y: cell.offsetTop,
			}));
			moves = slots.map((slot, index) => {
				const target = slots[slotOfCell[index] ?? index] ?? slot;
				return { x: target.x - slot.x, y: target.y - slot.y };
			});
			isSingleRow = slots.every((slot) => slot.y === slots[0]?.y);
			// The pin is for one row only, as on the source page. A folded grid is taller than the screen.
			// The stage must also fit under its sticky top, or its foot stays out of view during the sort.
			// getComputedStyle gives the sticky top in px, because a sticky block is positioned.
			const stickyTop = Number.parseFloat(window.getComputedStyle(stage).top);
			isPinned =
				isSingleRow && stickyTop + stage.offsetHeight <= window.innerHeight;
			section.toggleAttribute("data-pinned", isPinned);
		};

		/** The share of the scene that the scroll has passed, from 0 to 1. */
		const goalOf = () => {
			if (isPinned) {
				// The stage stands still while the runway scrolls under it. The sort follows the runway.
				// Before the pin the stage foot touches the runway top (0). At the end it touches the runway foot (1).
				const runwayRect = runway.getBoundingClientRect();
				const stageBottom = stage.getBoundingClientRect().bottom;
				const runwayShare = (stageBottom - runwayRect.top) / runwayRect.height;
				return Math.min(
					Math.max((runwayShare - PIN_HOLD) / (1 - 2 * PIN_HOLD), 0),
					1,
				);
			}
			const viewportHeight = window.innerHeight;
			const rect = grid.getBoundingClientRect();
			// One row on a short screen: the sort runs while the row moves from 72% to 16% of the screen height.
			// A folded grid is taller than the screen: the sort starts at 60% and ends when the grid foot is at 46%.
			const startTop = viewportHeight * (isSingleRow ? 0.72 : 0.6);
			const endTop = isSingleRow
				? viewportHeight * 0.16
				: viewportHeight * 0.46 - rect.height;
			return Math.min(
				Math.max((startTop - rect.top) / (startTop - endTop), 0),
				1,
			);
		};

		const paint = () => {
			frame = 0;
			const goal = goalOf();
			const rect = grid.getBoundingClientRect();
			const isOnScreen = rect.bottom > 0 && rect.top < window.innerHeight;
			// Off screen nobody sees the flight, so the cells jump. 0.002 is below one pixel of travel.
			shown =
				!isOnScreen || Math.abs(goal - shown) < 0.002
					? goal
					: shown + (goal - shown) * EASE_PER_FRAME;
			const pace = isSingleRow ? ROW_PACE : FOLDED_PACE;
			const sceneLength = pace.step * (cells.length - 1) + pace.flight;
			cells.forEach((cell, index) => {
				const move = moves[index];
				if (move === undefined) {
					return;
				}
				const local = Math.min(
					Math.max(
						(shown * sceneLength - pace.step * (turns[index] ?? 0)) /
							pace.flight,
						0,
					),
					1,
				);
				const eased = easeInOut(local);
				cell.style.transform = `translate(${(move.x * eased).toFixed(1)}px, ${(move.y * eased).toFixed(1)}px)`;
				// A cell in flight lies over the cells that stand. 40 is above every layer of a plate.
				cell.style.zIndex = local > 0 && local < 1 ? "40" : "";
			});
			const swap = Math.min(
				Math.max((shown - LABEL_SWAP_AT) / LABEL_SWAP_SPAN, 0),
				1,
			);
			section.style.setProperty("--nour-sort", shown.toFixed(4));
			// The share of ink in each label: the label of the current order is in ink, the other one in grey.
			section.style.setProperty("--nour-sort-from", (1 - swap).toFixed(3));
			section.style.setProperty("--nour-sort-to", swap.toFixed(3));
			if (shown !== goal) {
				frame = window.requestAnimationFrame(paint);
			}
		};
		const schedule = () => {
			if (frame === 0) {
				frame = window.requestAnimationFrame(paint);
			}
		};
		const remeasure = () => {
			measure();
			schedule();
		};

		measure();
		// The first value has no flight: a page that loads below the window shows the sorted grid at once.
		shown = goalOf();
		schedule();
		window.addEventListener("scroll", schedule, { passive: true });
		// A change of the screen height alone does not resize the grid, but it can start or stop the pin.
		window.addEventListener("resize", remeasure);
		// The grid changes size with the window, and when a font or a photo arrives.
		const resizeObserver = new ResizeObserver(remeasure);
		resizeObserver.observe(grid);
		return () => {
			window.cancelAnimationFrame(frame);
			window.removeEventListener("scroll", schedule);
			window.removeEventListener("resize", remeasure);
			resizeObserver.disconnect();
			section.removeAttribute("data-pinned");
			for (const cell of cells) {
				cell.style.removeProperty("transform");
				cell.style.removeProperty("z-index");
			}
			for (const name of [
				"--nour-sort",
				"--nour-sort-from",
				"--nour-sort-to",
			]) {
				section.style.removeProperty(name);
			}
		};
	}, [sectionRef, gridRef, slotOfCell]);
}
