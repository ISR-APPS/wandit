// The Assignments page behind login, in the layout of the kit task list: the title with an export button,
// a filter field with the Status and Wait filters and the column menu, then the work table with the long pager.
// The /app/assignments route renders it after its loader. `?submission=<id>` opens one submission in a side panel.
import {
	ArrowDownIcon,
	ArrowRightIcon,
	ArrowUpIcon,
	CheckCircleIcon,
	CheckIcon,
	CircleDashedIcon,
	DownloadSimpleIcon,
	type Icon,
} from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	type CsvColumn,
	copyToClipboard,
	dayCountFormat,
	downloadCsv,
	FRESH_WAIT_DAYS,
	fillMessage,
	GRADING_TARGET_DAYS,
	PageError,
	SUBMISSION_STATUSES,
	type SubmissionStatus,
	toCsv,
	WAIT_BANDS,
	type WaitBand,
	waitDaysOf,
} from "~/features/school";
import { type TranslationKey, useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import {
	type RecordColumn,
	RecordFilter,
	RecordTable,
} from "~/shared/ui/record-table";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	type Submission,
	submissionsQueryOptions,
} from "../api/submissions.queries";
import { SubmissionSheet } from "./submission-sheet";

// The route of this page. Its search param holds the open submission.
const assignmentsRoute = getRouteApi("/app/assignments");

/** The icon of each submission state, as the kit status column. */
const STATUS_ICON = {
	to_grade: CircleDashedIcon,
	graded: CheckCircleIcon,
} satisfies Record<SubmissionStatus, Icon>;

/** The arrow of each wait band, as the kit priority column: up is the most urgent. */
const WAIT_LOOK = {
	overdue: { icon: ArrowUpIcon, className: "text-destructive" },
	waiting: { icon: ArrowRightIcon, className: "" },
	fresh: { icon: ArrowDownIcon, className: "" },
} satisfies Record<WaitBand, { icon: Icon; className: string }>;

// The choices of "Rows per page". The first page shows 25 rows, as the kit task list.
const PAGE_SIZES = [10, 25, 50];
const DEFAULT_PAGE_SIZE = 25;

// The CSV columns of the work list. The page export and the bulk export use them.
function submissionCsvColumns(
	t: (key: TranslationKey) => string,
): CsvColumn<Submission>[] {
	return [
		{ header: t("assignments.id"), value: (row) => row.id.toUpperCase() },
		{
			header: t("assignments.assignment"),
			value: (row) => row.assignmentTitle,
		},
		{ header: t("assignments.course"), value: (row) => row.courseCode },
		{ header: t("assignments.student"), value: (row) => row.studentName },
		{
			header: t("assignments.status"),
			value: (row) => t(`assignments.statuses.${row.status}`),
		},
		{
			header: t("assignments.grade"),
			value: (row) => (row.points === null ? "" : String(row.points)),
		},
	];
}

/** The two filters narrow the rows; then RecordTable searches, sorts, selects, and pages them. */
export function AssignmentsPage() {
	const { t, locale } = useT();
	const { submission: openSubmissionId } = assignmentsRoute.useSearch();
	const navigate = assignmentsRoute.useNavigate();
	const { data: submissions } = useSuspenseQuery(submissionsQueryOptions());
	const [status, setStatus] = useState<string | null>(null);
	const [wait, setWait] = useState<string | null>(null);
	const number = new Intl.NumberFormat(locale);
	const dayCount = dayCountFormat(locale);
	const now = Date.now();
	const rows = submissions.filter(
		(row) =>
			(status === null || row.status === status) &&
			(wait === null || row.waitBand === wait),
	);
	const bandLabel = (band: WaitBand) =>
		fillMessage(t(`grading.bands.${band}`), {
			fresh: number.format(FRESH_WAIT_DAYS),
			target: number.format(GRADING_TARGET_DAYS),
		});
	const openSubmission = (id: string) =>
		void navigate({ search: { submission: id } });

	const columns: RecordColumn<Submission>[] = [
		{
			id: "id",
			header: t("assignments.id"),
			sortValue: (row) => row.id,
			cell: (row) => (
				<span className="whitespace-nowrap tabular-nums">
					{row.id.toUpperCase()}
				</span>
			),
		},
		{
			id: "title",
			header: t("assignments.assignment"),
			sortValue: (row) => row.assignmentTitle,
			cell: (row) => (
				<button
					type="button"
					onClick={() => openSubmission(row.id)}
					className="flex max-w-xl items-center gap-2 text-start hover:underline"
				>
					<Badge variant="outline">{t(`assignments.kinds.${row.kind}`)}</Badge>
					<span className="truncate font-medium">{row.assignmentTitle}</span>
					<span className="@4xl/main:inline hidden truncate text-muted-foreground">
						{`${row.studentName} · ${row.courseCode}`}
					</span>
				</button>
			),
		},
		{
			id: "status",
			header: t("assignments.status"),
			sortValue: (row) => row.status,
			hideable: true,
			cell: (row) => {
				const StatusIcon = STATUS_ICON[row.status];
				return (
					<span className="flex items-center gap-2 whitespace-nowrap">
						<StatusIcon
							aria-hidden="true"
							className="size-4 text-muted-foreground"
						/>
						{t(`assignments.statuses.${row.status}`)}
					</span>
				);
			},
		},
		{
			id: "wait",
			header: t("assignments.wait"),
			// The work that waits longest sorts last in the ascending order, as the most urgent priority.
			sortValue: (row) =>
				row.gradedAt === null ? waitDaysOf(row.submittedAt, now) : -1,
			hideable: true,
			cell: (row) => {
				// Graded work shows how long it waited for its grade.
				if (row.gradedAt !== null) {
					return (
						<span className="flex items-center gap-2 whitespace-nowrap text-muted-foreground">
							<CheckIcon aria-hidden="true" className="size-4" />
							{fillMessage(t("assignments.gradedIn"), {
								days: dayCount.format(
									waitDaysOf(row.submittedAt, Date.parse(row.gradedAt)),
								),
							})}
						</span>
					);
				}
				// The query gives a band to every work with no grade. A row without one shows a dash.
				if (row.waitBand === null) {
					return "–";
				}
				const look = WAIT_LOOK[row.waitBand];
				return (
					<span
						className={cn(
							"flex items-center gap-2 whitespace-nowrap",
							look.className,
						)}
					>
						<look.icon aria-hidden="true" className="size-4" />
						{bandLabel(row.waitBand)}
					</span>
				);
			},
		},
	];

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("assignments.title")}
				description={t("assignments.description")}
				actions={
					<Button
						type="button"
						aria-label={t("common.exportCsv")}
						onClick={() =>
							downloadCsv(
								"submissions.csv",
								toCsv(rows, submissionCsvColumns(t)),
							)
						}
					>
						<DownloadSimpleIcon />
						<span className="hidden lg:inline">{t("common.exportCsv")}</span>
					</Button>
				}
			/>
			<RecordTable
				rows={rows}
				columns={columns}
				searchText={(row) =>
					`${row.id} ${row.assignmentTitle} ${row.studentName} ${row.courseCode} ${row.courseTitle}`
				}
				searchPlaceholder={t("assignments.search")}
				toolbar={
					<>
						<RecordFilter
							label={t("assignments.status")}
							options={SUBMISSION_STATUSES.map((value) => ({
								value,
								label: t(`assignments.statuses.${value}`),
							}))}
							value={status}
							onValueChange={setStatus}
						/>
						<RecordFilter
							label={t("assignments.wait")}
							options={WAIT_BANDS.map((value) => ({
								value,
								label: bandLabel(value),
							}))}
							value={wait}
							onValueChange={setWait}
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
								"submissions-selected.csv",
								toCsv(selected, submissionCsvColumns(t)),
							)
						}
					>
						<DownloadSimpleIcon />
						{t("table.exportSelected")}
					</Button>
				)}
				rowMenu={(row) => (
					<>
						<DropdownMenuItem onSelect={() => openSubmission(row.id)}>
							{t("assignments.openSubmission")}
						</DropdownMenuItem>
						<DropdownMenuItem
							onSelect={() =>
								copyToClipboard(row.id.toUpperCase(), {
									done: t("table.copied"),
									failed: t("table.copyFailed"),
								})
							}
						>
							{t("table.copyId")}
						</DropdownMenuItem>
					</>
				)}
				pageSize={DEFAULT_PAGE_SIZE}
				pageSizeOptions={PAGE_SIZES}
				noResults={t("assignments.noResults")}
			/>
			<SubmissionSheet
				submissionId={openSubmissionId}
				onClose={() => void navigate({ search: {} })}
			/>
		</div>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

/** Placeholder while the loader runs: the header, the toolbar, and the table. */
export function AssignmentsPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-4 w-80 max-w-full" />
			</div>
			<Skeleton className="h-9 w-full sm:max-w-md" />
			<div className="grid gap-2 rounded-md border p-3">
				{SKELETON_ROWS.map((key) => (
					<Skeleton key={key} className="h-10 w-full" />
				))}
			</div>
		</div>
	);
}

/** Error state when the loader fails. Try again runs the loader again. */
export function AssignmentsPageError() {
	const { t } = useT();
	return <PageError message={t("assignments.loadError")} />;
}
