// Tells a wide table that the window has room for all of its columns.
// The payees and statements tables read it and drop their least useful columns under 80rem.
// It reads a media query through useSyncExternalStore, so no effect runs.
import { useSyncExternalStore } from "react";

// At 80rem (1280 px) the open sidebar leaves about 976 px to a table. Under it, seven columns do not fit.
const WIDE_QUERY = "(min-width: 80rem)";

function subscribe(onChange: () => void): () => void {
	const media = window.matchMedia(WIDE_QUERY);
	media.addEventListener("change", onChange);
	return () => media.removeEventListener("change", onChange);
}

/** True from 80rem. The pages behind login render in the browser; a server render reads false, the short table. */
export function useIsWideWindow(): boolean {
	return useSyncExternalStore(
		subscribe,
		() => window.matchMedia(WIDE_QUERY).matches,
		() => false,
	);
}
