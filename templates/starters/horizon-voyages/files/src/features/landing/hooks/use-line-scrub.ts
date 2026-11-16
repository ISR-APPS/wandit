// The one scrubbed scene of the page: the horizon strip of LineSection travels sideways while the visitor scrolls down.
// LineSection calls this hook with its section and its strip window. It writes two CSS variables on the section.
// landing.css reads them. Below 900px, with reduced motion, or with no script, the strip is a native swipe area.
import { type RefObject, useEffect } from "react";

/** The media query of the scrub. landing.css uses the same query for the tall section and the sticky stage. */
const SCRUB_QUERY =
	"(min-width: 900px) and (prefers-reduced-motion: no-preference)";

/**
 * Starts the scrub. `sectionRef` is the tall section; `windowRef` is the strip window that clips the track.
 * The section gets `data-scrub="on"`, `--hz-line-progress` (0 to 1), and `--hz-line-travel` (the track overflow in px).
 * While the scrub runs, the window leaves the tab order.
 */
export function useLineScrub(
	sectionRef: RefObject<HTMLElement | null>,
	windowRef: RefObject<HTMLElement | null>,
) {
	// effect: the scroll position, the viewport size, and a media query are browser values. One frame per scroll writes them into CSS.
	useEffect(() => {
		const section = sectionRef.current;
		const stripWindow = windowRef.current;
		const track = stripWindow?.firstElementChild;
		if (
			section === null ||
			stripWindow === null ||
			!(track instanceof HTMLElement)
		) {
			return;
		}
		const query = window.matchMedia(SCRUB_QUERY);
		let frame = 0;
		const update = () => {
			frame = 0;
			if (!query.matches) {
				// The window scrolls by hand again, so the keyboard can reach it again.
				stripWindow.tabIndex = 0;
				section.removeAttribute("data-scrub");
				section.style.removeProperty("--hz-line-progress");
				section.style.removeProperty("--hz-line-travel");
				return;
			}
			if (section.getAttribute("data-scrub") !== "on") {
				// The swipe position of a phone layout must not add to the scrub offset.
				stripWindow.scrollLeft = 0;
				// The scrub clips the window, so the arrow keys cannot scroll it. A tab stop there does nothing.
				stripWindow.tabIndex = -1;
				section.setAttribute("data-scrub", "on");
			}
			const box = section.getBoundingClientRect();
			// The scroll distance of the scene: the section height minus the one screen that the sticky stage covers.
			const distance = box.height - window.innerHeight;
			const progress =
				distance > 0 ? Math.min(1, Math.max(0, -box.top / distance)) : 0;
			const travel = Math.max(0, track.offsetWidth - stripWindow.clientWidth);
			section.style.setProperty("--hz-line-progress", progress.toFixed(4));
			section.style.setProperty("--hz-line-travel", `${travel}px`);
		};
		// Many scroll events can come in one frame. Only the first one asks for a frame.
		const schedule = () => {
			if (frame === 0) {
				frame = window.requestAnimationFrame(update);
			}
		};
		update();
		window.addEventListener("scroll", schedule, { passive: true });
		window.addEventListener("resize", schedule);
		query.addEventListener("change", schedule);
		return () => {
			window.removeEventListener("scroll", schedule);
			window.removeEventListener("resize", schedule);
			query.removeEventListener("change", schedule);
			window.cancelAnimationFrame(frame);
		};
	}, [sectionRef, windowRef]);
}
