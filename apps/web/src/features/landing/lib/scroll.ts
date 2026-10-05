/**
 * Scroll helpers and section ids of the landing page. The nav, the footer,
 * the ideas wall, and the closing panel call them. The scroll is smooth
 * only when the visitor does not ask for reduced motion.
 */

/**
 * Id of the top ember panel: the hero of the home page, or the header of the
 * pricing page. The nav measures it to pick its look over ember.
 */
export const HERO_PANEL_ID = "hero";

/** Id of the closing panel. The nav measures it like the hero panel. */
export const CLOSING_PANEL_ID = "start";

function scrollBehavior(): ScrollBehavior {
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches
		? "auto"
		: "smooth";
}

/**
 * Scrolls to a section and moves the keyboard focus into it, so the next
 * Tab starts there. The section needs tabIndex={-1} to take the focus.
 */
export function scrollToId(id: string) {
	const target = document.getElementById(id);
	if (!target) return;
	target.scrollIntoView({ behavior: scrollBehavior() });
	target.focus({ preventScroll: true });
}

/** Scrolls to the hero at the page top. The nav logo and the ideas wall call it. */
export function scrollToTop() {
	window.scrollTo({ top: 0, behavior: scrollBehavior() });
}

/** Scrolls up to the hero and puts the caret in its prompt box. */
export function focusHeroPrompt() {
	scrollToTop();
	document
		.querySelector<HTMLTextAreaElement>(`#${HERO_PANEL_ID} textarea`)
		?.focus({ preventScroll: true });
}
