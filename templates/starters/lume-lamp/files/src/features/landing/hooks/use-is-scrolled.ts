// Tells whether the visitor has scrolled past the top of the page.
// SiteHeader calls it to switch to the blurred bar. It reads the scroll position with useSyncExternalStore.
import { useSyncExternalStore } from "react";

// 32px: the header changes after a small scroll, not on the first pixel.
const SCROLL_THRESHOLD_PX = 32;

function subscribe(onChange: () => void) {
	window.addEventListener("scroll", onChange, { passive: true });
	return () => window.removeEventListener("scroll", onChange);
}

function isPastThreshold() {
	return window.scrollY > SCROLL_THRESHOLD_PX;
}

// The server renders the page at the top, so the prerendered header is the plain one.
function isAtTopOnServer() {
	return false;
}

/** True when the page is scrolled more than 32px. False on the server. */
export function useIsScrolled() {
	return useSyncExternalStore(subscribe, isPastThreshold, isAtTopOnServer);
}
