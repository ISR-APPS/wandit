// Every time entry of one matter in a RecordTable: the day, the person, the work, the hours, the amount, the state.
// MatterDetailPage renders it in the "Time entries" tab. A state filter cuts the rows; selected rows export as CSV.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { useState } from "react";
import {
	CURRENCY,
	dayToDate,
	downloadCsv,
	fillMessage,
	hoursFormat,
	moneyFormat,
	toCsv,
	toTenths,
} from "~/features/practice";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import {
	type RecordColumn,
	RecordFilter,
	RecordTable,
} from "~/shared/ui/record-table";
import {
	ENTRY_STATE_BADGE,
	type EntryBillingState,
	entryBillingState,
} from "../lib/entry-billing";
import type { TimeEntryLine } from "../lib/matter-joins";

// A list page shows twenty rows, as the kit list pages do.
const ENTRIES_PAGE_SIZE = 20;

const ENTRY_STATES: EntryBillingState[] = ["unbilled", "billed", "notBillable"];

type TimeEntriesTableProps = {
	/** Newest first. */
	entries: TimeEntryLine[];
	/** The file number of the matter. It names the CSV file. */
	matterNumber: string;
};

/** The state filter is page state; RecordTable searches, sorts, and pages the rows after it. */
export function TimeEntriesTable({
	entries,
	matterNumber,
}: TimeEntriesTableProps) {
	const { t, locale } = useT();
	const [state, setState] = useState<string | null>(null);
	const hours = hoursFormat(locale);
	const money = moneyFormat(locale);
	const date = new Intl.DateTimeFormat(locale, {
		dateStyle: "medium",
		timeZone: "UTC",
	});
	const rows = entries.filter(
		(entry) => state === null || entryBillingState(entry) === state,
	);
	const totalHours = toTenths(
		entries.reduce((sum, entry) => sum + entry.hours, 0),
	);
	const columns: RecordColumn<TimeEntryLine>[] = [
		{
			id: "day",
			header: t("matters.date"),
			sortValue: (entry) => entry.day,
			cell: (entry) => (
				<span className="whitespace-nowrap tabular-nums">
					{date.format(dayToDate(entry.day))}
				</span>
			),
		},
		{
			id: "person",
			header: t("matters.person"),
			hideable: true,
			sortValue: (entry) => entry.attorneyName,
			cell: (entry) => entry.attorneyName,
		},
		{
			id: "work",
			header: t("matters.work"),
			hideable: true,
			cell: (entry) => (
				<span className="block max-w-80 truncate" dir="auto">
					{entry.description}
				</span>
			),
		},
		{
			id: "hours",
			header: t("matters.hours"),
			align: "end",
			sortValue: (entry) => entry.hours,
			cell: (entry) => hours.format(entry.hours),
		},
		{
			id: "amount",
			header: t("matters.amount"),
			align: "end",
			hideable: true,
			sortValue: (entry) => entry.amount,
			cell: (entry) => money.format(entry.amount),
		},
		{
			id: "state",
			header: t("matters.status"),
			hideable: true,
			sortValue: (entry) => entryBillingState(entry),
			cell: (entry) => {
				const entryState = entryBillingState(entry);
				return (
					<Badge variant={ENTRY_STATE_BADGE[entryState]}>
						{t(`matters.entryStates.${entryState}`)}
					</Badge>
				);
			},
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
			<CardContent>
				<RecordTable
					rows={rows}
					columns={columns}
					searchText={(entry) => `${entry.description} ${entry.attorneyName}`}
					searchPlaceholder={t("matters.filterEntries")}
					pageSize={ENTRIES_PAGE_SIZE}
					noResults={t("matters.noEntries")}
					selectable
					toolbar={
						<RecordFilter
							label={t("matters.status")}
							options={ENTRY_STATES.map((value) => ({
								value,
								label: t(`matters.entryStates.${value}`),
							}))}
							value={state}
							onValueChange={setState}
						/>
					}
					bulkActions={(selected) => (
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="h-9"
							onClick={() =>
								downloadCsv(
									`time-${matterNumber}.csv`,
									toCsv(selected, [
										{ header: t("matters.date"), value: (entry) => entry.day },
										{
											header: t("matters.person"),
											value: (entry) => entry.attorneyName,
										},
										{
											header: t("matters.work"),
											value: (entry) => entry.description,
										},
										{
											header: t("matters.hours"),
											value: (entry) => String(entry.hours),
										},
										{
											header: `${t("matters.amount")} (${CURRENCY})`,
											value: (entry) => String(entry.amount),
										},
										{
											header: t("matters.status"),
											value: (entry) =>
												t(`matters.entryStates.${entryBillingState(entry)}`),
										},
									]),
								)
							}
						>
							<DownloadSimpleIcon />
							{t("table.exportSelected")}
						</Button>
					)}
				/>
			</CardContent>
		</Card>
	);
}
