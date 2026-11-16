// Tells if the visitor has scrolled past the first screen. CallBar reads it to slide in on a phone.
// It reads the scroll position with useSyncExternalStore, so no effect runs. The server answers false.
import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void): () => void {
	window.addEventListener("scroll", onChange, { passive: true });
	window.addEventListener("resize", onChange);
	return () => {
		window.removeEventListener("scroll", onChange);
		window.removeEventListener("resize", onChange);
	};
}

// 0.8 of the screen height: the hero count and its link have left the screen.
function readIsPastHero(): boolean {
	return window.scrollY > window.innerHeight * 0.8;
}

function readOnServer(): boolean {
	return false;
}

/** True after 80% of one screen height of scroll. Each scroll event compares one boolean, so React re-renders only on a change. */
export function useIsPastHero(): boolean {
	return useSyncExternalStore(subscribe, readIsPastHero, readOnServer);
}
