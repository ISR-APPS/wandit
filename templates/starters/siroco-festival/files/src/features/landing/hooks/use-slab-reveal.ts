// The slab entrances of the poster page. LandingPage calls this hook with its root element.
// It sets data-motion="on" on the root, then data-slab="in" on each [data-slab] element that reaches the start line.
// landing.css hides only the slabs in "wait" state under data-motion="on". So with no script every slab shows.
// A slab with data-watch="parent" starts with its parent: a cropped glyph can sit fully outside the clip while it waits.
import { type RefObject, useEffect } from "react";

/** A slab starts when its top passes this share of the viewport height. */
const START_LINE = 0.82;

/** Slides each [data-slab] of `pageRef` in once, when it reaches the start line. Reduced motion keeps every slab still. */
export function useSlabReveal(pageRef: RefObject<HTMLElement | null>) {
	// effect: IntersectionObserver, scroll, and matchMedia are browser APIs. They start the entrances.
	useEffect(() => {
		const page = pageRef.current;
		if (
			page === null ||
			window.matchMedia("(prefers-reduced-motion: reduce)").matches
		) {
			return;
		}
		const slabs = [...page.querySelectorAll<HTMLElement>("[data-slab]")];
		// A slab that is already on the screen, or above it, shows at once. So the first screen never blinks.
		for (const slab of slabs) {
			const isPassed =
				slab.getBoundingClientRect().top < window.innerHeight * START_LINE;
			slab.dataset.slab = isPassed ? "in" : "wait";
		}
		page.dataset.motion = "on";
		// Each watched element starts the slabs that wait on it: itself, or the glyphs inside it.
		const slabsOfTarget = new Map<Element, HTMLElement[]>();
		for (const slab of slabs) {
			if (slab.dataset.slab !== "wait") {
				continue;
			}
			const target =
				slab.dataset.watch === "parent" && slab.parentElement !== null
					? slab.parentElement
					: slab;
			slabsOfTarget.set(target, [...(slabsOfTarget.get(target) ?? []), slab]);
		}
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						startTarget(entry.target);
					}
				}
			},
			{ rootMargin: `0px 0px -${Math.round((1 - START_LINE) * 100)}% 0px` },
		);
		function startTarget(target: Element) {
			for (const slab of slabsOfTarget.get(target) ?? []) {
				slab.dataset.slab = "in";
			}
			slabsOfTarget.delete(target);
			observer.unobserve(target);
		}
		// One scroll step can jump fully past a short slab, so the observer never sees it intersect.
		// This check starts every slab above the start line, once per frame.
		let frame = 0;
		function startPassedTargets() {
			frame = 0;
			const line = window.innerHeight * START_LINE;
			for (const target of [...slabsOfTarget.keys()]) {
				if (target.getBoundingClientRect().top < line) {
					startTarget(target);
				}
			}
			if (slabsOfTarget.size === 0) {
				window.removeEventListener("scroll", onScroll);
			}
		}
		function onScroll() {
			if (frame === 0) {
				frame = window.requestAnimationFrame(startPassedTargets);
			}
		}
		for (const target of slabsOfTarget.keys()) {
			observer.observe(target);
		}
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => {
			window.removeEventListener("scroll", onScroll);
			window.cancelAnimationFrame(frame);
			observer.disconnect();
			delete page.dataset.motion;
		};
	}, [pageRef]);
}
