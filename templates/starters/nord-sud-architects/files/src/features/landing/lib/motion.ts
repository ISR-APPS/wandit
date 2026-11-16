// Motion helpers of the Atelier Nord-Sud page. The scroll hooks call them inside their effects only.
// They read window, so no component calls them during render: the page prerenders on the server.

/** True when the visitor asks the system for less motion. The page then shows every figure fully drawn. */
export function prefersReducedMotion() {
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** True when the scroll draws the villa plan: a screen of 1024px or more, and no request for less motion. */
export function isScrubPlanScreen() {
	return window.matchMedia(
		"(min-width: 1024px) and (prefers-reduced-motion: no-preference)",
	).matches;
}
