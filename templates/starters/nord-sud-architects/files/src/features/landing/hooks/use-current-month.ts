// The month of the visit, for the DATE cells of the title blocks and the red visa.
// The hero, the contact section, and the footer call it. A drawing carries its true month.
// The prerendered HTML is built on another day, so the server value is null and the browser fills it in.
import { useSyncExternalStore } from "react";

/** The current month as text, "MM.YYYY", for example "11.2026". */
function readMonth() {
	const now = new Date();
	return `${String(now.getMonth() + 1).padStart(2, "0")}.${now.getFullYear()}`;
}

// A visit is shorter than a month, so no event reads the month again.
function subscribe() {
	return () => {};
}

/** Returns "MM.YYYY" in the browser, and null on the server and during hydration. */
export function useCurrentMonth() {
	return useSyncExternalStore(subscribe, readMonth, () => null);
}
