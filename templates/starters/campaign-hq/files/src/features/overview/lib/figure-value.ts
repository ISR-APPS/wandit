// The text of one home figure: a count, a percent, an amount, or a multiple such as "3.2×".
// The stat cards and the "Period results" rows call it.
import { formatMultiple, moneyFormat } from "~/features/marketing";
import type { OverviewFigure } from "../api/overview.queries";

/** A null value (no divisor) gives "–", never a false 0. An amount under 100 keeps its cents. */
export function formatFigureValue(
	figure: OverviewFigure,
	locale: string,
): string {
	if (figure.value === null) {
		return "–";
	}
	if (figure.display === "money") {
		return moneyFormat(locale, figure.value < 100 ? "cents" : "whole").format(
			figure.value,
		);
	}
	if (figure.display === "multiple") {
		return formatMultiple(figure.value, locale);
	}
	if (figure.display === "percent") {
		return new Intl.NumberFormat(locale, {
			style: "percent",
			minimumFractionDigits: 1,
			maximumFractionDigits: 1,
		}).format(figure.value);
	}
	return new Intl.NumberFormat(locale).format(figure.value);
}
