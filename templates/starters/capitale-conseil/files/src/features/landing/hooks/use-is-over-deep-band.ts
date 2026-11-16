// Tells the index spine when it floats over a deep band. IndexSpine calls it with its own element.
// It reads the window scroll through useSyncExternalStore, so it needs no effect.
import { type RefObject, useCallback, useSyncExternalStore } from "react";
import { subscribeToScroll } from "../lib/scroll-store";

/** The rail and the band must overlap by more than 8px. A 1px touch does not flip the rail. */
const OVERLAP_MARGIN_PX = 8;

function readServerOverlap(): boolean {
	return false;
}

/**
 * True while the box of `railRef` overlaps a `[data-deep-band]` section.
 * The rail then takes the pale band ink. With the dark ink it is not visible on the band.
 */
export function useIsOverDeepBand(
	railRef: RefObject<HTMLElement | null>,
): boolean {
	const readOverlap = useCallback(() => {
		const rail = railRef.current?.getBoundingClientRect();
		// A hidden rail (below 1180px) has no height.
		if (rail === undefined || rail.height === 0) {
			return false;
		}
		for (const band of document.querySelectorAll("[data-deep-band]")) {
			const box = band.getBoundingClientRect();
			if (
				box.top < rail.bottom - OVERLAP_MARGIN_PX &&
				box.bottom > rail.top + OVERLAP_MARGIN_PX
			) {
				return true;
			}
		}
		return false;
	}, [railRef]);
	return useSyncExternalStore(
		subscribeToScroll,
		readOverlap,
		readServerOverlap,
	);
}
