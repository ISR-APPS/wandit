// The rep targets card of the targets page: one table row per rep with the pace, the email, the target,
// and the booked amount. TargetsPage renders it full width under the middle grid.
// RecordTable gives the filter field, the column menu, the checkboxes, the row menu, and the pages.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { repCsvColumns } from "~/features/reps";
import {
	copyToClipboard,
	downloadCsv,
	moneyFormat,
	PACE_STATUSES,
	PaceBadge,
	toCsv,
} from "~/features/sales";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import { type RecordColumn, RecordTable } from "~/shared/ui/record-table";
import type { RepTarget } from "../api/targets.queries";

// 5 rows per page keep the whole card on one screen under the middle grid.
const PAGE_SIZE = 5;

type RepTargetsCardProps = {
	/** Every rep of the quarter, the best attainment first. */
	reps: RepTarget[];
};

/** The selected rows can leave as CSV. */
export function RepTargetsCard({ reps }: RepTargetsCardProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const columns: RecordColumn<RepTarget>[] = [
		{
			id: "status",
			header: t("reps.status"),
			sortValue: (rep) => PACE_STATUSES.indexOf(rep.status),
			cell: (rep) => <PaceBadge status={rep.status} />,
		},
		{
			id: "name",
			header: t("reps.name"),
			sortValue: (rep) => rep.name,
			cell: (rep) => (
				<Link
					to="/app/reps/$repId"
					params={{ repId: rep.id }}
					className="font-medium hover:underline"
				>
					{rep.name}
				</Link>
			),
		},
		{
			id: "email",
			header: t("reps.email"),
			hideable: true,
			sortValue: (rep) => rep.email,
			cell: (rep) => rep.email,
		},
		{
			id: "target",
			header: t("targets.target"),
			align: "end",
			hideable: true,
			sortValue: (rep) => rep.target,
			cell: (rep) => money.format(rep.target),
		},
		{
			id: "booked",
			header: t("targets.booked"),
			align: "end",
			sortValue: (rep) => rep.booked,
			cell: (rep) => money.format(rep.booked),
		},
	];

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("targets.repsTitle")}</CardTitle>
			</CardHeader>
			<CardContent className="min-w-0">
				<RecordTable
					rows={reps}
					columns={columns}
					searchText={(rep) => `${rep.name} ${rep.email}`}
					searchPlaceholder={t("reps.search")}
					selectable
					bulkActions={(selected) => (
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="h-9"
							onClick={() =>
								downloadCsv(
									"rep-targets-selected.csv",
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
			</CardContent>
		</Card>
	);
}
