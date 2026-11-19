// The deal table: RecordTable with the deal columns, a row menu, row selection, and the export of the selected rows.
// The Table view of the Deals page and the "need attention" card of the home render it. They filter the rows first.
import {
	DownloadSimpleIcon,
	FlagPennantIcon,
	WarningIcon,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
	copyToClipboard,
	DEAL_STAGES,
	DealStageBadge,
	dayCountFormat,
	downloadCsv,
	formatRelativeTime,
	isStalledDeal,
	moneyFormat,
	PersonAvatar,
	toCsv,
} from "~/features/crm";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import { type RecordColumn, RecordTable } from "~/shared/ui/record-table";
import type { Deal } from "../api/deals.queries";
import { daysInStage, isPastCloseDate } from "../lib/deal-attention";
import { dealCsvColumns } from "../lib/deal-csv";

type DealTableProps = {
	/** The deals to list, after the filters of the page. */
	deals: Deal[];
	/** "attention" shows the days in the stage (home). "list" shows the last activity (Deals page). */
	variant: "attention" | "list";
	/** Rows per page: 8 on the home card, 20 on the Deals page. */
	pageSize: number;
	/** True adds the filter field. The Deals page has its own search, so it passes false. */
	searchable: boolean;
	/** Filter buttons after the filter field. */
	toolbar?: ReactNode;
	/** Text when no row matches. */
	noResults: string;
};

/** The deal name links to the deal page. A stalled deal and a past close date show a flag in the warning or the error color. */
export function DealTable({
	deals,
	variant,
	pageSize,
	searchable,
	toolbar,
	noResults,
}: DealTableProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	const dayCount = dayCountFormat(locale);
	const now = Date.now();

	const columns: RecordColumn<Deal>[] = [
		{
			id: "deal",
			header: t("deals.deal"),
			sortValue: (row) => row.name,
			// justify-items-start: each line is as wide as its text, so dir="auto" text sits at the start side.
			cell: (row) => (
				<div className="grid justify-items-start">
					<Link
						to="/app/deals/$dealId"
						params={{ dealId: row.id }}
						className="font-medium hover:underline"
						dir="auto"
					>
						{row.name}
					</Link>
					<span className="text-muted-foreground text-xs" dir="auto">
						{row.companyName}
					</span>
				</div>
			),
		},
		{
			id: "stage",
			header: t("deals.stage"),
			sortValue: (row) => DEAL_STAGES.indexOf(row.stage),
			cell: (row) => <DealStageBadge stage={row.stage} />,
		},
		{
			id: "owner",
			header: t("deals.owner"),
			hideable: true,
			sortValue: (row) => row.ownerName,
			cell: (row) => (
				<span className="flex items-center gap-2">
					<PersonAvatar name={row.ownerName} className="size-6 text-xs" />
					<bdi>{row.ownerName}</bdi>
				</span>
			),
		},
		{
			id: "close",
			header: t("deals.closeDate"),
			hideable: true,
			// A closed deal sorts by its real close day, an open deal by the expected day.
			sortValue: (row) => Date.parse(row.closedAt ?? row.expectedCloseAt),
			cell: (row) =>
				isPastCloseDate(row, now) ? (
					<span className="inline-flex items-center gap-1 text-destructive tabular-nums">
						<WarningIcon className="size-3.5" />
						<span className="sr-only">{t("deals.pastCloseDate")}</span>
						{date.format(new Date(row.expectedCloseAt))}
					</span>
				) : (
					<span className="tabular-nums">
						{date.format(new Date(row.closedAt ?? row.expectedCloseAt))}
					</span>
				),
		},
		variant === "attention"
			? {
					id: "daysInStage",
					header: t("deals.daysInStage"),
					hideable: true,
					align: "end",
					sortValue: (row) => daysInStage(row, now),
					cell: (row) =>
						isStalledDeal(row, now) ? (
							<span className="inline-flex items-center gap-1 font-medium text-warning">
								<FlagPennantIcon className="size-3.5" />
								<span className="sr-only">{t("deals.stalled")}</span>
								{dayCount.format(daysInStage(row, now))}
							</span>
						) : (
							dayCount.format(daysInStage(row, now))
						),
				}
			: {
					id: "lastActivity",
					header: t("deals.lastActivity"),
					hideable: true,
					sortValue: (row) => Date.parse(row.lastActivityAt),
					cell: (row) => (
						<span className="text-muted-foreground">
							{formatRelativeTime(row.lastActivityAt, now, locale)}
						</span>
					),
				},
		{
			id: "amount",
			header: t("deals.amount"),
			align: "end",
			sortValue: (row) => row.amount,
			cell: (row) => (
				<span className="font-medium">{money.format(row.amount)}</span>
			),
		},
	];

	return (
		<RecordTable
			rows={deals}
			columns={columns}
			searchText={
				searchable
					? (row) =>
							`${row.name} ${row.companyName} ${row.contactName} ${row.ownerName}`
					: undefined
			}
			searchPlaceholder={t("deals.filterPlaceholder")}
			toolbar={toolbar}
			pageSize={pageSize}
			noResults={noResults}
			selectable
			bulkActions={(selectedRows) => (
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="h-9"
					onClick={() =>
						downloadCsv(
							"deals-selected.csv",
							toCsv(selectedRows, dealCsvColumns(t, now)),
						)
					}
				>
					<DownloadSimpleIcon />
					{t("table.exportSelected")}
				</Button>
			)}
			rowMenu={(row) => (
				<>
					<DropdownMenuItem asChild>
						<Link to="/app/deals/$dealId" params={{ dealId: row.id }}>
							{t("deals.openDeal")}
						</Link>
					</DropdownMenuItem>
					<DropdownMenuItem
						onSelect={() =>
							copyToClipboard(row.id, {
								done: t("table.copied"),
								failed: t("table.copyFailed"),
							})
						}
					>
						{t("deals.copyId")}
					</DropdownMenuItem>
				</>
			)}
		/>
	);
}
