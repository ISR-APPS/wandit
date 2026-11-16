// The block-pop entrance of the home page. LandingPage calls it once with its root element.
// It adds .cn-live to the root, then shows each [data-pop], [data-cell], and .cn-meter block when it enters the screen.
// landing.css holds the hidden and the shown states. Without this hook every block is visible.
import { type RefObject, useEffect } from "react";

/** The meters fill in 1.05 s; the % cap counts up in the same time. */
const COUNT_MS = 1050;
const BLOCK_SELECTOR = "[data-pop], [data-cell], .cn-meter";

/**
 * Counts the text of a meter cap from 0 to its `data-count` value, with the ease of the fill.
 * `data-format` is the cap message, for example "{value}%". `frames` keeps the pending frame id for the cleanup.
 */
function countUp(cap: HTMLElement, frames: Set<number>) {
	const target = Number(cap.dataset.count);
	const format = cap.dataset.format ?? "{value}";
	const start = performance.now();
	const step = (now: number, frame: number) => {
		frames.delete(frame);
		const progress = Math.min(1, (now - start) / COUNT_MS);
		// Cubic ease-out, the same curve as the max-width transition of the fill.
		const eased = 1 - (1 - progress) ** 3;
		cap.textContent = format.replace(
			"{value}",
			String(Math.round(target * eased)),
		);
		if (progress < 1) {
			schedule();
		}
	};
	const schedule = () => {
		const frame = requestAnimationFrame((now) => step(now, frame));
		frames.add(frame);
	};
	schedule();
}

/**
 * Starts the reveals under `rootRef`. Blocks already on screen at hydration stay visible, so nothing flashes.
 * With prefers-reduced-motion the hook does nothing and the page stays in its final state.
 */
export function useBlockPop(rootRef: RefObject<HTMLElement | null>) {
	// effect: IntersectionObserver and matchMedia are browser APIs. The reveal state lives in DOM classes.
	useEffect(() => {
		const root = rootRef.current;
		if (
			root === null ||
			window.matchMedia("(prefers-reduced-motion: reduce)").matches
		) {
			return;
		}
		// Each group staggers its children in DOM order: 60 ms a block, 28 ms a timetable cell.
		for (const group of root.querySelectorAll<HTMLElement>("[data-stagger]")) {
			group
				.querySelectorAll<HTMLElement>("[data-pop], [data-cell]")
				.forEach((block, index) => {
					block.style.setProperty("--cn-i", String(index));
				});
		}
		const blocks = [...root.querySelectorAll<HTMLElement>(BLOCK_SELECTOR)];
		// A block on screen or above it at hydration stays visible. The page can hydrate after a scroll.
		const isSeen = (block: HTMLElement) =>
			block.getBoundingClientRect().top < window.innerHeight;
		const pending = new Set(blocks.filter((block) => !isSeen(block)));
		for (const block of blocks) {
			if (!pending.has(block)) {
				block.classList.add("is-in");
			}
		}
		root.classList.add("cn-live");
		// The frame ids of the running count-ups. The cleanup cancels them, so no loop writes to a removed node.
		const frames = new Set<number>();

		const show = (block: HTMLElement) => {
			pending.delete(block);
			observer.unobserve(block);
			block.classList.add("is-in");
			const cap = block.querySelector<HTMLElement>("[data-count]");
			if (cap !== null) {
				countUp(cap, frames);
			}
		};
		const observer = new IntersectionObserver(
			() => {
				// An anchor jump or a fast scroll can pass a short block with no intersection.
				// So each callback shows every pending block whose top passed 92% of the screen.
				const line = window.innerHeight * 0.92;
				for (const block of pending) {
					if (block.getBoundingClientRect().top < line) {
						show(block);
					}
				}
			},
			// The callback runs when a block crosses the line at 92% of the screen height.
			{ rootMargin: "0px 0px -8% 0px" },
		);
		for (const block of pending) {
			observer.observe(block);
		}
		return () => {
			observer.disconnect();
			for (const frame of frames) {
				cancelAnimationFrame(frame);
			}
			root.classList.remove("cn-live");
		};
	}, [rootRef]);
}
