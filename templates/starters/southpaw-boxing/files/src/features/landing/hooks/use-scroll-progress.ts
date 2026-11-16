// Scroll position of the page as a share from 0 to 1.
// site-header.tsx calls it to size the gold progress bar under the nav.
// It reads window scroll events through useSyncExternalStore, so it needs no effect.
import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void): () => void {
	window.addEventListener("scroll", onChange, { passive: true });
	window.addEventListener("resize", onChange);
	return () => {
		window.removeEventListener("scroll", onChange);
		window.removeEventListener("resize", onChange);
	};
}

function getScrollProgress(): number {
	const scrollable = document.documentElement.scrollHeight - window.innerHeight;
	if (scrollable <= 0) {
		return 0;
	}
	// Steps of 0.5% keep the header from a render on each scrolled pixel.
	return Math.round(Math.min(1, window.scrollY / scrollable) * 200) / 200;
}

function getServerProgress(): number {
	return 0;
}

/** The scrolled share of the page, from 0 at the top to 1 at the bottom, in steps of 0.005. */
export function useScrollProgress(): number {
	return useSyncExternalStore(subscribe, getScrollProgress, getServerProgress);
}
