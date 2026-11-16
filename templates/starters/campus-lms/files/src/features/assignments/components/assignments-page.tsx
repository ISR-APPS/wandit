// The Assignments page behind login: three meter figures, the submission table with its status filter, and the next deadlines.
// The /app/assignments route renders it after its loader. The route also uses the skeleton and the error below.
// A row opens the side panel of the submission through the `?submission=` search param.
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	calendarDaysFromNow,
	dateFormat,
	FIRST_COLUMN_ON_PHONE,
	fillMessage,
	GRADING_TARGET_DAYS,
	type MeterFigure,
	MeterFigures,
	MeterFiguresSkeleton,
	PASS_POINTS,
	PageError,
	PersonAvatar,
	StatusFilter,
	SUBMISSION_STATUSES,
	type SubmissionStatus,
	WaitBadge,
	waitDaysOf,
} from "~/features/school";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Card, CardContent } from "~/shared/ui/card";
import { DataTable, type DataTableColumn } from "~/shared/ui/data-table";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	type Submission,
	submissionsQueryOptions,
} from "../api/submissions.queries";
import { DueNextCard } from "./due-next-card";
import { SubmissionSheet } from "./submission-sheet";

// The route of this page. Its search param holds the open submission.
const assignmentsRoute = getRouteApi("/app/assignments");

// One column under 42rem, so each label and share line has a full row. Three equal columns from 42rem.
const FIGURE_GRID = "@2xl/main:grid-cols-3";
// The table and the deadline rail. The rail joins the row only on a wide page, so the table keeps its columns.
const BODY_GRID =
	"grid items-start gap-6 @5xl/main:grid-cols-[minmax(0,1fr)_18rem]";

/** The filter opens on "To grade": that is the work of the day. The oldest work comes first there. */
export function AssignmentsPage() {
	const { t, locale } = useT();
	const { submission: openSubmissionId } = assignmentsRoute.useSearch();
	const navigate = assignmentsRoute.useNavigate();
	const { data: submissions } = useSuspenseQuery(submissionsQueryOptions());
	const [status, setStatus] = useState<SubmissionStatus | "all">("to_grade");
	const number = new Intl.NumberFormat(locale);
	const date = dateFormat(locale);
	const now = Date.now();

	const graded = submissions.filter((row) => row.gradedAt !== null);
	const countOf = (value: SubmissionStatus) =>
		submissions.filter((row) => row.status === value).length;
	// The queue reads oldest first. The other tabs keep the newest first.
	const rows =
		status === "all"
			? submissions
			: status === "to_grade"
				? submissions.filter((row) => row.status === "to_grade").reverse()
				: submissions.filter((row) => row.status === status);
	const targetDays = number.format(GRADING_TARGET_DAYS);
	const statusOptions = [
		...SUBMISSION_STATUSES.map((value) => ({
			value,
			label: t(`assignments.statuses.${value}`),
			count: countOf(value),
		})),
		{
			value: "all" as const,
			label: t("common.all"),
			count: submissions.length,
		},
	];

	const figures: MeterFigure[] = [
		{
			id: "on-time",
			label: t("assignments.onTime"),
			value: submissions.filter((row) => !row.isLate).length,
			whole: submissions.length,
			wholeWords: t("assignments.ofAllWork"),
			emptyWords: t("assignments.noWork"),
		},
		{
			id: "graded-in-target",
			label: fillMessage(t("assignments.gradedInTarget"), {
				target: targetDays,
			}),
			// The days from the submission to the grade, in calendar days, as the waiting bands count them.
			value: graded.filter(
				(row) =>
					row.gradedAt !== null &&
					calendarDaysFromNow(row.gradedAt, Date.parse(row.submittedAt)) <=
						GRADING_TARGET_DAYS,
			).length,
			whole: graded.length,
			wholeWords: t("assignments.ofGradedWork"),
			emptyWords: t("assignments.noGrade"),
		},
		{
			id: "passed",
			label: fillMessage(t("assignments.passed"), {
				points: number.format(PASS_POINTS),
			}),
			value: graded.filter(
				(row) => row.points !== null && row.points >= PASS_POINTS,
			).length,
			whole: graded.length,
			wholeWords: t("assignments.ofGradedWork"),
			emptyWords: t("assignments.noGrade"),
		},
	];

	// The state of one row: the wait of a submission with no grade, else "Graded".
	const statusBadge = (row: Submission) =>
		row.waitBand ? (
			<WaitBadge band={row.waitBand} days={waitDaysOf(row.submittedAt, now)} />
		) : (
			<Badge variant="success">{t("assignments.statuses.graded")}</Badge>
		);

	const allColumns: DataTableColumn<Submission>[] = [
		{
			id: "assignment",
			header: t("assignments.submission"),
			sortValue: (row) => row.assignmentTitle,
			// On a phone this is the only column, so it also shows the student and the state.
			cell: (row) => (
				<Link
					to="/app/assignments"
					search={{ submission: row.id }}
					aria-label={fillMessage(t("assignments.open"), {
						name: row.studentName,
					})}
					className="grid justify-items-start gap-0.5"
				>
					<span className="font-medium hover:underline">
						{row.assignmentTitle}
					</span>
					<span className="text-muted-foreground text-xs">
						{fillMessage(t("assignments.courseKind"), {
							code: row.courseCode,
							kind: t(`assignments.kinds.${row.kind}`),
						})}
					</span>
					<span className="mt-1 flex @2xl/main:hidden flex-wrap items-center gap-2">
						{statusBadge(row)}
						<span className="text-muted-foreground text-xs">
							{row.studentName}
						</span>
					</span>
				</Link>
			),
		},
		{
			id: "student",
			header: t("assignments.student"),
			sortValue: (row) => row.studentName,
			cell: (row) => (
				<span className="flex items-center gap-2">
					<PersonAvatar name={row.studentName} className="size-7" />
					<span className="truncate">{row.studentName}</span>
				</span>
			),
		},
		{
			id: "submitted",
			header: t("assignments.submitted"),
			sortValue: (row) => Date.parse(row.submittedAt),
			// An absolute date: the Status badge already gives the wait in days.
			cell: (row) => (
				<span className="flex items-center gap-2">
					<span className="whitespace-nowrap text-muted-foreground">
						{date.format(new Date(row.submittedAt))}
					</span>
					{row.isLate ? (
						<Badge variant="outline">{t("assignments.late")}</Badge>
					) : null}
				</span>
			),
		},
		{
			id: "status",
			header: t("assignments.status"),
			sortValue: (row) =>
				row.gradedAt === null ? -waitDaysOf(row.submittedAt, now) : 1,
			cell: statusBadge,
		},
		{
			id: "grade",
			header: t("assignments.grade"),
			align: "end",
			sortValue: (row) => row.points ?? -1,
			cell: (row) =>
				row.points === null ? (
					<span className="text-muted-foreground">—</span>
				) : (
					<span className="font-semibold">{number.format(row.points)}</span>
				),
		},
	];
	// No row of the "To grade" tab has a grade, so that tab drops the empty column.
	const columns =
		status === "to_grade"
			? allColumns.filter((column) => column.id !== "grade")
			: allColumns;

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("assignments.title")}
				description={t("assignments.description")}
			/>
			<MeterFigures items={figures} className={FIGURE_GRID} />
			<div className={BODY_GRID}>
				<Card className="min-w-0">
					<CardContent className={FIRST_COLUMN_ON_PHONE}>
						<DataTable
							// A new tab starts at page 1 with no sort.
							key={status}
							rows={rows}
							columns={columns}
							searchText={(row) =>
								`${row.assignmentTitle} ${row.studentName} ${row.courseCode} ${row.courseTitle}`
							}
							noResults={t("assignments.noResults")}
							toolbar={
								<StatusFilter
									options={statusOptions}
									value={status}
									onValueChange={setStatus}
									className="w-full sm:w-auto"
								/>
							}
						/>
					</CardContent>
				</Card>
				{/* The table is much longer than the rail. Sticky keeps the deadlines in view while the table scrolls. */}
				<div className="@5xl/main:sticky @5xl/main:top-6">
					<DueNextCard />
				</div>
			</div>
			<SubmissionSheet
				submissionId={openSubmissionId}
				onClose={() => void navigate({ search: {} })}
			/>
		</div>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8"];

/** Placeholder while the loader runs: the header, the figures, the table, and the deadline card. */
export function AssignmentsPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-44" />
				<Skeleton className="h-4 w-80 max-w-full" />
			</div>
			<MeterFiguresSkeleton count={3} className={FIGURE_GRID} />
			<div className={BODY_GRID}>
				<Card>
					<CardContent className="grid gap-3">
						<Skeleton className="h-9 w-full sm:max-w-xs" />
						{SKELETON_ROWS.map((key) => (
							<Skeleton key={key} className="h-12 w-full" />
						))}
					</CardContent>
				</Card>
				<Skeleton className="h-80 rounded-surface" />
			</div>
		</div>
	);
}

/** Error state of the page when the loader fails. Try again runs the loader again. */
export function AssignmentsPageError() {
	const { t } = useT();
	return <PageError message={t("assignments.loadError")} />;
}
