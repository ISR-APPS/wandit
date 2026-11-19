// The reps list behind login: the header with Export, then the table with the filter field,
// the pace, territory, and role filters, the column menu, the row checkboxes, and the row menu.
// The /app/reps route renders it after its loader. A name links to the page of the rep.
// The filters are state; the rows of the table are derived during render.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	copyToClipboard,
	downloadCsv,
	fillMessage,
	PACE_STATUSES,
	PaceBadge,
	PageError,
	percentFormat,
	REP_ROLES,
	RepAvatar,
	toCsv,
} from "~/features/sales";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import {
	type RecordColumn,
	RecordFilter,
	RecordTable,
} from "~/shared/ui/record-table";
import { Skeleton } from "~/shared/ui/skeleton";
import { type RepSummary, repsQueryOptions } from "../api/reps.queries";
import { repCsvColumns } from "../lib/rep-csv";

// Shows 10 rows per page. 10 rows fit one laptop screen under the filters.
const PAGE_SIZE = 10;

/** The list page. The three filters narrow the rows; RecordTable searches, sorts, and pages them. */
export function RepsPage() {
	const { t, locale } = useT();
	const { data: board } = useSuspenseQuery(repsQueryOptions());
	const [pace, setPace] = useState<string | null>(null);
	const [territory, setTerritory] = useState<string | null>(null);
	const [role, setRole] = useState<string | null>(null);
	const percent = percentFormat(locale);

	const rows = board.reps.filter(
		(rep) =>
			(pace === null || rep.status === pace) &&
			(territory === null || rep.territoryId === territory) &&
			(role === null || rep.role === role),
	);

	const columns: RecordColumn<RepSummary>[] = [
		{
			id: "name",
			header: t("reps.name"),
			cell: (rep) => (
				<Link
					to="/app/reps/$repId"
					params={{ repId: rep.id }}
					className="flex items-center gap-4 hover:underline"
				>
					<RepAvatar name={rep.name} />
					<span className="font-medium">{rep.name}</span>
				</Link>
			),
		},
		{
			id: "role",
			header: t("reps.role"),
			hideable: true,
			sortValue: (rep) => t(`roles.${rep.role}`),
			cell: (rep) => t(`roles.${rep.role}`),
		},
		{
			id: "territory",
			header: t("reps.territory"),
			hideable: true,
			sortValue: (rep) => rep.territoryName,
			cell: (rep) => rep.territoryName,
		},
		{
			id: "email",
			header: t("reps.email"),
			hideable: true,
			sortValue: (rep) => rep.email,
			cell: (rep) => rep.email,
		},
		{
			id: "attainment",
			header: t("reps.attainment"),
			hideable: true,
			sortValue: (rep) => rep.attainment,
			cell: (rep) => percent.format(rep.attainment),
		},
		{
			id: "status",
			header: t("reps.status"),
			sortValue: (rep) => PACE_STATUSES.indexOf(rep.status),
			cell: (rep) => <PaceBadge status={rep.status} />,
		},
	];

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("reps.title")}
				description={fillMessage(t("reps.description"), {
					quarter: board.quarterLabel,
				})}
				actions={
					<Button
						type="button"
						onClick={() =>
							downloadCsv("reps.csv", toCsv(rows, repCsvColumns(t)))
						}
					>
						<DownloadSimpleIcon />
						{t("common.exportCsv")}
					</Button>
				}
			/>
			<RecordTable
				rows={rows}
				columns={columns}
				searchText={(rep) => `${rep.name} ${rep.email}`}
				searchPlaceholder={t("reps.search")}
				toolbar={
					<>
						<RecordFilter
							label={t("reps.status")}
							options={PACE_STATUSES.map((status) => ({
								value: status,
								label: t(`pace.${status}`),
							}))}
							value={pace}
							onValueChange={setPace}
						/>
						<RecordFilter
							label={t("reps.territory")}
							options={board.territories.map((row) => ({
								value: row.id,
								label: row.name,
							}))}
							value={territory}
							onValueChange={setTerritory}
						/>
						<RecordFilter
							label={t("reps.role")}
							options={REP_ROLES.map((option) => ({
								value: option,
								label: t(`roles.${option}`),
							}))}
							value={role}
							onValueChange={setRole}
						/>
					</>
				}
				selectable
				bulkActions={(selected) => (
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-9"
						onClick={() =>
							downloadCsv(
								"reps-selected.csv",
								toCsv(selected, repCsvColumns(t)),
							)
						}
					>
						<DownloadSimpleIcon />
						{t("table.exportSelected")}
					</Button>
				)}
				rowMenu={(rep) => (
					<>
						<DropdownMenuItem asChild>
							<Link to="/app/reps/$repId" params={{ repId: rep.id }}>
								{t("reps.viewRep")}
							</Link>
						</DropdownMenuItem>
						<DropdownMenuItem asChild>
							<a href={`mailto:${rep.email}`}>{t("reps.sendEmail")}</a>
						</DropdownMenuItem>
						<DropdownMenuItem
							onSelect={() =>
								copyToClipboard(rep.email, {
									done: t("table.copied"),
									failed: t("table.copyFailed"),
								})
							}
						>
							{t("reps.copyEmail")}
						</DropdownMenuItem>
					</>
				)}
				pageSize={PAGE_SIZE}
				noResults={t("reps.noResults")}
			/>
		</div>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

/** Placeholder while the list loader runs. The route sets it as pendingComponent. */
export function RepsPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-48" />
				<Skeleton className="h-4 w-72 max-w-full" />
			</div>
			<div className="flex flex-wrap gap-2">
				<Skeleton className="h-9 w-full sm:max-w-sm" />
				<Skeleton className="h-9 w-64" />
			</div>
			<div className="grid gap-2">
				{SKELETON_ROWS.map((key) => (
					<Skeleton key={key} className="h-12 w-full" />
				))}
			</div>
		</div>
	);
}

/** Error state of the list and of the rep page when a loader fails. The routes set it as errorComponent. */
export function RepsPageError() {
	const { t } = useT();
	return <PageError message={t("reps.loadError")} />;
}
