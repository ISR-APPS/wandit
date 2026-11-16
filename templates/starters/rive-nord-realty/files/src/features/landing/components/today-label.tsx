// The date of the board in the hero tag line, for example "Monday 27 July 2026".
// HeroSection renders it. The prerender cannot know the day of the visit, so the server prints "Today".
// The browser reads the date with useSyncExternalStore after hydration, so no effect runs.
import { useSyncExternalStore } from "react";
import { useT } from "~/shared/i18n";

// The date changes only at midnight, and a stale label until the next visit is fine.
function subscribe(): () => void {
	return () => {};
}

function readServerDate(): null {
	return null;
}

/** Long date in the page language. */
export function TodayLabel() {
	const { t, locale } = useT();
	const today = useSyncExternalStore(
		subscribe,
		() =>
			new Intl.DateTimeFormat(locale, {
				weekday: "long",
				day: "numeric",
				month: "long",
				year: "numeric",
			}).format(new Date()),
		readServerDate,
	);
	return <>{today ?? t("hero.today")}</>;
}
