// The table card of the home: the approved and pending leave from today on, the soonest first.
// DashboardPage renders it beside the calendar card and passes the rows. The /app loader fills the request list.
// It follows the latest payments card of the kit: the filter field sits in the card head, the table pages under it.
import { useState } from "react";
import { fillMessage } from "~/features/people";
import { RequestTable, type TimeOffRequest } from "~/features/time-off";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Input } from "~/shared/ui/input";

// Eight rows keep the card as tall as the calendar card beside it. The time-off page shows the rest.
const UPCOMING_PAGE_SIZE = 8;

type UpcomingTimeOffCardProps = {
	/** The approved and pending requests that end today or later, the soonest first day first. */
	requests: TimeOffRequest[];
};

/** The field filters by name, job title, and request number before the table sorts and pages. */
export function UpcomingTimeOffCard({ requests }: UpcomingTimeOffCardProps) {
	const { t, locale } = useT();
	const [query, setQuery] = useState("");
	const needle = query.trim().toLocaleLowerCase(locale);
	const rows = needle
		? requests.filter((request) =>
				`${request.employeeName} ${request.employeeTitle} ${request.id}`
					.toLocaleLowerCase(locale)
					.includes(needle),
			)
		: requests;

	return (
		// In the 3-column band, this card takes two columns beside the calendar.
		<Card className="@4xl/main:col-span-2 min-w-0">
			<CardHeader>
				<CardTitle>{t("dashboard.upcomingTitle")}</CardTitle>
				<CardDescription>
					{fillMessage(t("dashboard.upcomingDescription"), {
						count: new Intl.NumberFormat(locale).format(requests.length),
					})}
				</CardDescription>
				<CardAction>
					<Input
						type="search"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder={t("timeOff.filterPlaceholder")}
						aria-label={t("timeOff.filterPlaceholder")}
						className="w-40 sm:w-56"
					/>
				</CardAction>
			</CardHeader>
			<CardContent>
				<RequestTable
					requests={rows}
					variant="upcoming"
					pageSize={UPCOMING_PAGE_SIZE}
					searchable={false}
					noResults={t("dashboard.noUpcoming")}
				/>
			</CardContent>
		</Card>
	);
}
