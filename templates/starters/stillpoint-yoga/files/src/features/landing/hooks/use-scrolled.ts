// Tells whether the page has left its top. SiteHeader calls it to switch from clear to a blurred bone bar.
// It reads window.scrollY through useSyncExternalStore, so the server and the first paint both say "not scrolled".
import { useSyncExternalStore } from "react";

/** 36px: the header turns solid once the hero headline starts to pass under it. */
const SCROLLED_AFTER_PX = 36;

function subscribe(onChange: () => void) {
	window.addEventListener("scroll", onChange, { passive: true });
	return () => window.removeEventListener("scroll", onChange);
}

/** True when the page is scrolled past 36px. Always false on the server. */
export function useScrolled(): boolean {
	return useSyncExternalStore(
		subscribe,
		() => window.scrollY > SCROLLED_AFTER_PX,
		() => false,
	);
}
