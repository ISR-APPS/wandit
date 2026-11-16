// The time entries of one matter: tabs for all, unbilled, and billed time, then a paged table.
// MatterDetailPage renders it in the main column, under the facts.
import { useState } from "react";
import {
	dayToDate,
	fillMessage,
	hoursFormat,
	moneyFormat,
} from "~/features/practice";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { DataTable, type DataTableColumn } from "~/shared/ui/data-table";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import type { TimeEntryLine } from "../lib/matter-joins";

// The tabs of the card. Unbilled is billable time that no invoice charges yet.
const ENTRY_VIEWS = ["all", "unbilled", "billed"] as const;
type EntryView = (typeof ENTRY_VIEWS)[number];

const VIEW_LABEL = {
	all: "matters.allEntries",
	unbilled: "matters.unbilledEntries",
	billed: "matters.billedEntries",
} as const satisfies Record<EntryView, string>;

function isInView(entry: TimeEntryLine, view: EntryView): boolean {
	if (view === "unbilled") {
		return entry.billable && entry.invoiceId === null;
	}
	return view === "billed" ? entry.invoiceId !== null : true;
}

type TimeEntriesCardProps = {
	/** Every entry of the matter, newest first. */
	entries: TimeEntryLine[];
	/** All logged hours of the matter, from its ledger. */
	totalHours: number;
};

/**
 * The tab counts equal the rows of each tab. A tab with no row stays, so the three tabs never move.
 * The tabs sit on their own row under the title, so they fit at 375 px.
 */
export function TimeEntriesCard({ entries, totalHours }: TimeEntriesCardProps) {
	const { t, locale } = useT();
	const [view, setView] = useState<EntryView>("all");
	const number = new Intl.NumberFormat(locale);
	const hours = hoursFormat(locale);
	const money = moneyFormat(locale);
	const dayFormat = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		year: "numeric",
		timeZone: "UTC",
	});
	const rows = entries.filter((entry) => isInView(entry, view));
	const columns: DataTableColumn<TimeEntryLine>[] = [
		{
			id: "day",
			header: t("matters.date"),
			sortValue: (row) => row.day,
			cell: (row) => (
				<span className="grid whitespace-nowrap tabular-nums">
					{dayFormat.format(dayToDate(row.day))}
					{/* On a phone the hours and amount columns are off screen, so they also show here. */}
					<span className="@2xl/main:hidden text-muted-foreground text-xs">
						{fillMessage(t("matters.hoursOnMatter"), {
							hours: hours.format(row.hours),
						})}
						{row.billable ? ` · ${money.format(row.amount)}` : null}
					</span>
				</span>
			),
		},
		{
			id: "work",
			header: t("matters.work"),
			// whitespace-normal: the kit table cells do not wrap, but a long work text must.
			// The person sits under the work text, so the date and the work fit at 375 px.
			cell: (row) => (
				<span className="grid min-w-40 gap-0.5 whitespace-normal">
					<span dir="auto">{row.description}</span>
					<span className="text-muted-foreground text-xs">
						{row.attorneyName}
					</span>
				</span>
			),
		},
		{
			id: "hours",
			header: t("matters.hours"),
			align: "end",
			sortValue: (row) => row.hours,
			cell: (row) => hours.format(row.hours),
		},
		{
			id: "amount",
			header: t("matters.amount"),
			align: "end",
			sortValue: (row) => row.amount,
			cell: (row) =>
				row.billable ? (
					money.format(row.amount)
				) : (
					<span className="whitespace-nowrap text-muted-foreground">
						{t("matters.notBillable")}
					</span>
				),
		},
	];
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("matters.timeEntries")}</CardTitle>
				<CardDescription>
					{fillMessage(t("matters.entriesSummary"), {
						hours: hours.format(totalHours),
					})}
				</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-3">
				<Tabs
					value={view}
					onValueChange={(value) =>
						setView(ENTRY_VIEWS.find((option) => option === value) ?? "all")
					}
					className="max-w-full overflow-x-auto"
				>
					<TabsList>
						{ENTRY_VIEWS.map((option) => (
							<TabsTrigger key={option} value={option}>
								{t(VIEW_LABEL[option])}
								<span className="text-muted-foreground tabular-nums">
									{number.format(
										entries.filter((entry) => isInView(entry, option)).length,
									)}
								</span>
							</TabsTrigger>
						))}
					</TabsList>
				</Tabs>
				<DataTable
					key={view}
					rows={rows}
					columns={columns}
					noResults={t("matters.noEntries")}
				/>
			</CardContent>
		</Card>
	);
}
