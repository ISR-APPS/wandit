// The stream card of the Events page: the newest single events, with the person, the account, and the platform.
// EventsPage renders it under the catalog with the rows of the stream query.
// Under 1024 px the table has two columns: the time goes under the event, and the account under the user.
import { Link } from "@tanstack/react-router";
import {
	EventName,
	fillMessage,
	formatRelativeTime,
	TOUCH_AREA,
	useIsWideScreen,
} from "~/features/tracking";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { DataTable, type DataTableColumn } from "~/shared/ui/data-table";
import type { StreamEvent } from "../api/events.queries";

type EventStreamCardProps = {
	/** The newest events before now, newest first. */
	events: StreamEvent[];
};

/** The description gives the count of rows, so it always equals the rows of the table. */
export function EventStreamCard({ events }: EventStreamCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const now = Date.now();
	const isWide = useIsWideScreen();

	const accountLink = (row: StreamEvent, className?: string) => (
		<Link
			to="/app/accounts/$accountId"
			params={{ accountId: row.accountId }}
			className={cn("whitespace-nowrap hover:underline", TOUCH_AREA, className)}
		>
			{row.accountName}
		</Link>
	);

	const wideColumns: DataTableColumn<StreamEvent>[] = [
		{
			id: "time",
			header: t("events.stream.time"),
			sortValue: (row) => Date.parse(row.occurredAt),
			cell: (row) => (
				<span className="whitespace-nowrap text-muted-foreground">
					{formatRelativeTime(row.occurredAt, now, locale)}
				</span>
			),
		},
		{
			id: "event",
			header: t("events.columns.event"),
			sortValue: (row) => row.eventKey,
			cell: (row) => <EventName eventKey={row.eventKey} />,
		},
		{
			id: "person",
			header: t("events.stream.person"),
			sortValue: (row) => row.personName,
			cell: (row) => (
				<span className="whitespace-nowrap font-medium">{row.personName}</span>
			),
		},
		{
			id: "account",
			header: t("events.stream.account"),
			sortValue: (row) => row.accountName,
			cell: (row) => accountLink(row),
		},
		{
			id: "platform",
			header: t("events.stream.platform"),
			sortValue: (row) => row.platform,
			cell: (row) => t(`platforms.${row.platform}`),
		},
	];
	const phoneColumns: DataTableColumn<StreamEvent>[] = [
		{
			id: "event",
			header: t("events.columns.event"),
			sortValue: (row) => Date.parse(row.occurredAt),
			cell: (row) => (
				<div className="grid justify-items-start gap-1">
					<EventName eventKey={row.eventKey} />
					<span className="whitespace-nowrap text-muted-foreground text-xs">
						{formatRelativeTime(row.occurredAt, now, locale)}
					</span>
				</div>
			),
		},
		{
			id: "person",
			header: t("events.stream.person"),
			sortValue: (row) => row.personName,
			cell: (row) => (
				<div className="grid justify-items-start gap-1">
					<span className="whitespace-nowrap font-medium">
						{row.personName}
					</span>
					{accountLink(row, "text-muted-foreground text-xs")}
				</div>
			),
		},
	];

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("events.stream.title")}</CardTitle>
				<CardDescription>
					{fillMessage(t("events.stream.description"), {
						count: number.format(events.length),
					})}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<DataTable
					rows={events}
					columns={isWide ? wideColumns : phoneColumns}
					searchText={(row) =>
						`${row.eventKey} ${row.personName} ${row.accountName}`
					}
					noResults={t("events.stream.noResults")}
				/>
			</CardContent>
		</Card>
	);
}
