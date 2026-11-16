// The number and date formats of Studio OS, in the app language: money, hours, shares, and days.
// Every page and card of the studio features calls it, so one amount looks the same everywhere.
import { useT } from "~/shared/i18n";
import { STUDIO_CURRENCY } from "../lib/codes";
import { type Day, formatRelativeDay, parseDay } from "../lib/time";

/** The formatters of the app locale. Build them once per render of a component. */
export function useFormatters() {
	const { locale } = useT();
	const money = new Intl.NumberFormat(locale, {
		style: "currency",
		currency: STUDIO_CURRENCY,
		maximumFractionDigits: 0,
	});
	const compactMoney = new Intl.NumberFormat(locale, {
		style: "currency",
		currency: STUDIO_CURRENCY,
		notation: "compact",
		maximumFractionDigits: 1,
	});
	const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
	// Timesheets count quarter hours. Two decimals show 146.75 exactly, so the rows add up to their total.
	const hours = new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "hour",
		unitDisplay: "narrow",
		maximumFractionDigits: 2,
	});
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 0,
	});
	const shortDate = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
	});
	const longDate = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	return {
		locale,
		/** "€46,000". */
		money: (value: number) => money.format(value),
		/** "€46K", for chart axes and tight cells. */
		compactMoney: (value: number) => compactMoney.format(value),
		/** "1,284.5". */
		number: (value: number) => number.format(value),
		/** "32.75h". */
		hours: (value: number) => hours.format(value),
		/** 0.42 gives "42%". */
		percent: (value: number) => percent.format(value),
		/** "12 Nov". */
		shortDate: (day: Day) => shortDate.format(parseDay(day)),
		/** "12 Nov 2026". */
		longDate: (day: Day) => longDate.format(parseDay(day)),
		/** "in 3 days", "yesterday". */
		relativeDay: (day: Day) => formatRelativeDay(day, locale),
	};
}
