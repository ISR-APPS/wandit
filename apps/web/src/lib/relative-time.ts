import {
	getCurrentDictionary,
	getCurrentLocale,
} from "@/lib/i18n/locale-store";

export function relativeTime(iso: string): string {
	const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
	const absoluteSeconds = Math.abs(seconds);

	if (Number.isNaN(seconds) || absoluteSeconds < 45) {
		return getCurrentDictionary().common.time.justNow;
	}

	const direction = seconds >= 0 ? -1 : 1;
	const minutes = Math.round(absoluteSeconds / 60);
	const formatter = new Intl.RelativeTimeFormat(getCurrentLocale(), {
		numeric: "auto",
	});

	if (minutes < 60) return formatter.format(direction * minutes, "minute");

	const hours = Math.round(minutes / 60);
	if (hours < 24) return formatter.format(direction * hours, "hour");

	const days = Math.round(hours / 24);
	if (days < 7) return formatter.format(direction * days, "day");

	const weeks = Math.round(days / 7);
	if (weeks < 5) return formatter.format(direction * weeks, "week");

	const months = Math.round(days / 30);
	if (months < 12) return formatter.format(direction * months, "month");

	return formatter.format(direction * Math.round(days / 365), "year");
}
