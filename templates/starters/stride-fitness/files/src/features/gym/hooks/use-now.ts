// The current time, as a value that a component can read during render.
// The home, the class timetable, and the member pages use it for the now line, the live class, and "2 hours ago".
// It reads the browser clock through useSyncExternalStore, so no effect is needed.
import { useSyncExternalStore } from "react";
import { MINUTE_MS } from "../lib/gym-time";

// 15 s. The value changes once per minute, so a tick shows a new minute at most 15 s late.
const TICK_MS = 15_000;

function subscribe(onTick: () => void): () => void {
	const timer = window.setInterval(onTick, TICK_MS);
	return () => window.clearInterval(timer);
}

// The start of the current minute. A stable value between two minutes keeps React from a render loop.
function currentMinute(): number {
	return Math.floor(Date.now() / MINUTE_MS) * MINUTE_MS;
}

/** The start of the current minute, in milliseconds since 1970. The component renders again when the minute changes. */
export function useNow(): number {
	return useSyncExternalStore(subscribe, currentMinute, currentMinute);
}
