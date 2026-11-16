// Tells if the visitor scrolled past the top of the page.
// site-header.tsx calls it to show its bottom hairline.
// It reads window scroll events through useSyncExternalStore, so it needs no effect.
import { useSyncExternalStore } from "react";

/** Scroll distance in pixels after which the header shows its hairline. */
const SCROLLED_AFTER_PX = 70;

function subscribe(onChange: () => void): () => void {
	window.addEventListener("scroll", onChange, { passive: true });
	return () => window.removeEventListener("scroll", onChange);
}

function getIsScrolled(): boolean {
	return window.scrollY > SCROLLED_AFTER_PX;
}

function getServerIsScrolled(): boolean {
	return false;
}

/** True after 70px of scroll. The server HTML and the first render give false. */
export function useIsScrolled(): boolean {
	return useSyncExternalStore(subscribe, getIsScrolled, getServerIsScrolled);
}
