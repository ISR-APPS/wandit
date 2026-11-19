// The Table tab of the hiring page: every candidate on the board in one RecordTable, with a row menu and selection.
// HiringPage renders it with the candidates after its filters. A name opens the candidate dialog.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import {
	BOARD_STAGES,
	copyToClipboard,
	downloadCsv,
	formatRelativeTime,
	PersonAvatar,
	STAGE_BADGE,
	toCsv,
} from "~/features/people";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import { type RecordColumn, RecordTable } from "~/shared/ui/record-table";
import type { Candidate } from "../api/hiring.queries";
import { candidateCsvColumns } from "../lib/candidate-csv";
import { RatingStars } from "./rating-stars";

// Ten rows per page, as on the employee list.
const CANDIDATES_PAGE_SIZE = 10;

type CandidatesTableProps = {
	/** The candidates on the board, after the position filter and the search field. */
	candidates: Candidate[];
	/** Opens the candidate dialog of one candidate id. */
	onOpen: (candidateId: string) => void;
};

/** The page search field filters the rows, so the table has no filter field of its own. */
export function CandidatesTable({ candidates, onOpen }: CandidatesTableProps) {
	const { t, locale } = useT();
	const now = Date.now();

	const columns: RecordColumn<Candidate>[] = [
		{
			id: "name",
			header: t("hiring.candidate"),
			sortValue: (row) => row.name,
			cell: (row) => (
				<div className="flex items-center gap-3">
					<PersonAvatar name={row.name} />
					<div className="grid min-w-0 justify-items-start">
						<button
							type="button"
							onClick={() => onOpen(row.id)}
							className="font-medium outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
							dir="auto"
						>
							{row.name}
						</button>
						<span className="text-muted-foreground text-xs" dir="auto">
							{row.currentRole}
						</span>
					</div>
				</div>
			),
		},
		{
			id: "position",
			header: t("hiring.position"),
			hideable: true,
			sortValue: (row) => row.positionTitle,
			cell: (row) => (
				<span className="whitespace-nowrap" dir="auto">
					{row.positionTitle}
				</span>
			),
		},
		{
			id: "stage",
			header: t("hiring.stage"),
			sortValue: (row) =>
				BOARD_STAGES.findIndex((stage) => stage === row.stage),
			cell: (row) => (
				<Badge variant={STAGE_BADGE[row.stage]}>
					{t(`stages.${row.stage}`)}
				</Badge>
			),
		},
		{
			id: "source",
			header: t("hiring.source"),
			hideable: true,
			sortValue: (row) => row.source,
			cell: (row) => (
				<span className="whitespace-nowrap">{t(`sources.${row.source}`)}</span>
			),
		},
		{
			id: "rating",
			header: t("hiring.rating"),
			hideable: true,
			align: "end",
			sortValue: (row) => row.rating ?? 0,
			cell: (row) =>
				row.rating === null ? "–" : <RatingStars rating={row.rating} />,
		},
		{
			id: "applied",
			header: t("hiring.applied"),
			hideable: true,
			sortValue: (row) => row.appliedAt,
			cell: (row) => (
				<span className="whitespace-nowrap text-muted-foreground">
					{formatRelativeTime(row.appliedAt, now, locale)}
				</span>
			),
		},
	];

	return (
		<RecordTable
			rows={candidates}
			columns={columns}
			pageSize={CANDIDATES_PAGE_SIZE}
			noResults={t("hiring.noResults")}
			selectable
			bulkActions={(selectedRows) => (
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="h-9"
					onClick={() =>
						downloadCsv(
							"candidates-selected.csv",
							toCsv(selectedRows, candidateCsvColumns(t)),
						)
					}
				>
					<DownloadSimpleIcon />
					{t("table.exportSelected")}
				</Button>
			)}
			rowMenu={(row) => (
				<>
					<DropdownMenuItem onSelect={() => onOpen(row.id)}>
						{t("hiring.openCandidate")}
					</DropdownMenuItem>
					<DropdownMenuItem
						onSelect={() =>
							copyToClipboard(row.id, {
								done: t("table.copied"),
								failed: t("table.copyFailed"),
							})
						}
					>
						{t("table.copyId")}
					</DropdownMenuItem>
				</>
			)}
		/>
	);
}
