// The clock in the caption of the studio room. StudioRoom calls it with the room element.
// The minutes move from 07:04 to 07:52 while the room crosses the screen, as the morning passes.
// It reads the position through useSyncExternalStore: the server and reduced motion show 07:04.
import { type RefObject, useCallback, useSyncExternalStore } from "react";

/** The first and the last minute after seven that the caption shows. */
const FIRST_MINUTE = 4;
const LAST_MINUTE = 52;

/** The room ticks from when its top passes 85% of the screen until its bottom passes 15%. */
const START_AT = 0.85;
const END_AT = 0.15;

function subscribe(onChange: () => void) {
	window.addEventListener("scroll", onChange, { passive: true });
	window.addEventListener("resize", onChange);
	return () => {
		window.removeEventListener("scroll", onChange);
		window.removeEventListener("resize", onChange);
	};
}

/** The caption time, "07:04" to "07:52", for the scroll position of `roomRef`. */
export function useRoomClock(roomRef: RefObject<HTMLElement | null>): string {
	const readMinute = useCallback(() => {
		const room = roomRef.current;
		if (
			room === null ||
			window.matchMedia("(prefers-reduced-motion: reduce)").matches
		) {
			return FIRST_MINUTE;
		}
		const rect = room.getBoundingClientRect();
		const screen = window.innerHeight;
		const distance = rect.height + (START_AT - END_AT) * screen;
		const progress = Math.min(
			1,
			Math.max(0, (START_AT * screen - rect.top) / distance),
		);
		return Math.round(FIRST_MINUTE + progress * (LAST_MINUTE - FIRST_MINUTE));
	}, [roomRef]);
	const minute = useSyncExternalStore(
		subscribe,
		readMinute,
		() => FIRST_MINUTE,
	);
	return `07:${String(minute).padStart(2, "0")}`;
}
