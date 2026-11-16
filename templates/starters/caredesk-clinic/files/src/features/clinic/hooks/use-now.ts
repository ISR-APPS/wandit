// The current time, as a value that a component can read during render.
// The home page, the day board, and the lists use it for the now line and the late rows.
// It reads the browser clock through useSyncExternalStore, so no effect is needed.
import { useSyncExternalStore } from "react";
import { startOfMinute } from "../lib/clinic-day";

// 15 s. The value changes only once per minute, so a tick shows a new minute at most 15 s late.
const TICK_MS = 15_000;

/** 60 s, the refetch interval of every live query. A status changes during the day, and useNow() moves once per minute. */
export const LIVE_REFETCH_MS = 60_000;

function subscribe(onTick: () => void): () => void {
	const timer = window.setInterval(onTick, TICK_MS);
	return () => window.clearInterval(timer);
}

// The start of the current minute. A stable value between two minutes keeps React from a render loop.
function currentMinute(): number {
	return startOfMinute(Date.now());
}

/** The start of the current minute, in milliseconds since 1970. The component renders again when the minute changes. */
export function useNow(): number {
	return useSyncExternalStore(subscribe, currentMinute, currentMinute);
}
