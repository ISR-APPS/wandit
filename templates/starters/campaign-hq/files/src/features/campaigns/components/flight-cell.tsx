// The flight of one campaign in a table cell: the date range, then a muted line about where the flight stands.
// The campaign table renders it in its Flight column.
import {
	calendarDaysFromNow,
	dayCountFormat,
	fillMessage,
} from "~/features/marketing";
import { useT } from "~/shared/i18n";
import type { Campaign } from "../api/campaigns.queries";

type FlightCellProps = {
	/** One row of campaignsQueryOptions, with its totals to date. */
	campaign: Campaign;
	/** The time of the render, in milliseconds since 1970. The page reads it once for every row. */
	now: number;
};

/** The second line depends on the status: days left, a start, a pause date, or an end date. */
export function FlightCell({ campaign, now }: FlightCellProps) {
	const { t, locale } = useT();
	const dayCount = dayCountFormat(locale);
	const shortDate = new Intl.DateTimeFormat(locale, {
		month: "short",
		day: "numeric",
	});
	const status = campaign.status;
	const note =
		status === "live"
			? fillMessage(t("campaigns.daysLeft"), {
					// The last day of the flight counts as a day left.
					days: dayCount.format(calendarDaysFromNow(campaign.endAt, now) + 1),
				})
			: status === "planned"
				? fillMessage(t("campaigns.startsIn"), {
						days: dayCount.format(calendarDaysFromNow(campaign.startAt, now)),
					})
				: status === "paused" && campaign.pausedAt
					? fillMessage(t("campaigns.pausedOn"), {
							date: shortDate.format(new Date(campaign.pausedAt)),
						})
					: fillMessage(t("campaigns.endedOn"), {
							date: shortDate.format(new Date(campaign.endAt)),
						});
	return (
		<div className="grid whitespace-nowrap">
			{/* No year, so the cell stays narrow. Every flight is within a few months of today.
			    formatFlight (formatRange) adds both years when a flight crosses New Year, and the table then passes 1024 px. */}
			<span>{`${shortDate.format(new Date(campaign.startAt))} – ${shortDate.format(new Date(campaign.endAt))}`}</span>
			<span className="text-muted-foreground text-xs">{note}</span>
		</div>
	);
}
