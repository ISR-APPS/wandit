// A hook that tells if the screen is at least 1280 px wide, the Tailwind xl breakpoint.
// The directory and the request table read it: below that width they show fewer columns, so no column is cut.
// It reads the media query with useSyncExternalStore, so it needs no effect.
import { useSyncExternalStore } from "react";

// Tailwind xl. From this width the main column holds every table column next to the open sidebar.
const WIDE_QUERY = "(min-width: 1280px)";

function subscribeToWideQuery(onChange: () => void): () => void {
	const query = window.matchMedia(WIDE_QUERY);
	query.addEventListener("change", onChange);
	return () => query.removeEventListener("change", onChange);
}

/** True from 1280 px. The server snapshot is true, but the /app pages render in the browser only. */
export function useIsWideScreen(): boolean {
	return useSyncExternalStore(
		subscribeToWideQuery,
		() => window.matchMedia(WIDE_QUERY).matches,
		() => true,
	);
}
