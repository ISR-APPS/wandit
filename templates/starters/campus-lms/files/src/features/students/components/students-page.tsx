// The student list behind login: the page header, three meter figures, the status filter, and the searchable table.
// The /app/students route renders it after its loader. The route also uses the skeleton and the error below.
// A name opens the side panel of the student through the `?student=` search param.
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	FIRST_COLUMN_ON_PHONE,
	fillMessage,
	formatRelativeTime,
	type MeterFigure,
	MeterFigures,
	MeterFiguresSkeleton,
	PageError,
	PersonAvatar,
	STUDENT_STATUS_BADGE,
	STUDENT_STATUSES,
	StatusFilter,
	type StudentStatus,
} from "~/features/school";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Card, CardContent } from "~/shared/ui/card";
import { DataTable, type DataTableColumn } from "~/shared/ui/data-table";
import { Progress } from "~/shared/ui/progress";
import { Skeleton } from "~/shared/ui/skeleton";
import { type Student, studentsQueryOptions } from "../api/students.queries";
import { StudentSheet } from "./student-sheet";

// The route of this page. Its search param holds the open student.
const studentsRoute = getRouteApi("/app/students");

// One column under 42rem, so each label and share line has a full row. Three equal columns from 42rem.
const FIGURE_GRID = "@2xl/main:grid-cols-3";

/** The status filter narrows the rows; then DataTable searches, sorts, and pages them. */
export function StudentsPage() {
	const { t, locale } = useT();
	const { student: openStudentId } = studentsRoute.useSearch();
	const navigate = studentsRoute.useNavigate();
	const { data: students } = useSuspenseQuery(studentsQueryOptions());
	const [status, setStatus] = useState<StudentStatus | "all">("all");
	const number = new Intl.NumberFormat(locale);
	const now = Date.now();

	const countOf = (value: StudentStatus) =>
		students.filter((row) => row.status === value).length;
	const statusOptions = [
		{ value: "all" as const, label: t("common.all"), count: students.length },
		...STUDENT_STATUSES.map((value) => ({
			value,
			label: t(`students.statuses.${value}`),
			count: countOf(value),
		})).filter((option) => option.count > 0),
	];
	const rows =
		status === "all"
			? students
			: students.filter((row) => row.status === status);
	const inRunningCourse = countOf("on_track") + countOf("behind");

	const figures: MeterFigure[] = [
		{
			id: "active-this-week",
			label: t("students.activeThisWeek"),
			value: students.filter((row) => row.isActiveThisWeek).length,
			whole: students.length,
			wholeWords: t("students.ofAllStudents"),
			emptyWords: t("students.noStudents"),
		},
		{
			id: "on-track",
			label: t("students.onTrack"),
			value: countOf("on_track"),
			whole: inRunningCourse,
			wholeWords: t("students.ofRunning"),
			emptyWords: t("students.noStudents"),
		},
		{
			id: "returning",
			label: t("students.returning"),
			value: students.filter((row) => row.courseCount > 1).length,
			whole: students.length,
			wholeWords: t("students.ofAllStudents"),
			emptyWords: t("students.noStudents"),
		},
	];

	// Four columns fit a laptop page beside the sidebar. On a phone the first cell also shows the status.
	const columns: DataTableColumn<Student>[] = [
		{
			id: "name",
			header: t("students.student"),
			sortValue: (row) => row.name,
			cell: (row) => (
				<Link
					to="/app/students"
					search={{ student: row.id }}
					aria-label={fillMessage(t("students.open"), { name: row.name })}
					className="flex items-center gap-3"
				>
					<PersonAvatar name={row.name} />
					<span className="grid justify-items-start gap-1">
						<span className="font-medium hover:underline">{row.name}</span>
						<span className="@2xl/main:block hidden text-muted-foreground text-xs">
							{row.lastActiveAt
								? fillMessage(t("students.activeAgo"), {
										when: formatRelativeTime(row.lastActiveAt, now, locale),
									})
								: t("students.never")}
						</span>
						<span className="flex @2xl/main:hidden items-center gap-2">
							<Badge variant={STUDENT_STATUS_BADGE[row.status]}>
								{t(`students.statuses.${row.status}`)}
							</Badge>
							<span className="text-muted-foreground text-xs">
								{row.mainCourse.courseCode}
							</span>
						</span>
					</span>
				</Link>
			),
		},
		{
			id: "course",
			header: t("students.course"),
			sortValue: (row) => row.mainCourse.courseCode,
			cell: (row) => {
				// A running course counts only the open lessons, as the course page and the side panel do.
				const isRunning = row.mainCourse.courseStatus === "running";
				const whole = isRunning
					? row.mainCourse.released
					: row.mainCourse.lessonCount;
				return (
					<div className="grid min-w-40 max-w-56 gap-1.5">
						<span className="truncate">{row.mainCourse.courseTitle}</span>
						{row.mainCourse.courseStatus === "upcoming" ? (
							<span className="text-muted-foreground text-xs">
								{t("students.notStarted")}
							</span>
						) : (
							<span className="flex items-center gap-2">
								<Progress
									value={row.mainCourse.done}
									max={whole}
									className="h-1.5 w-20"
									aria-hidden="true"
								/>
								<span className="text-muted-foreground text-xs tabular-nums">
									{fillMessage(
										t(
											isRunning
												? "students.lessonsOpenShort"
												: "students.lessonsShort",
										),
										{
											done: number.format(row.mainCourse.done),
											total: number.format(whole),
										},
									)}
								</span>
							</span>
						)}
					</div>
				);
			},
		},
		{
			id: "grade",
			header: t("students.average"),
			align: "end",
			sortValue: (row) => row.averageGrade ?? -1,
			cell: (row) =>
				row.averageGrade === null ? (
					<span className="text-muted-foreground">—</span>
				) : (
					number.format(Math.round(row.averageGrade))
				),
		},
		{
			id: "status",
			header: t("students.status"),
			sortValue: (row) => STUDENT_STATUSES.indexOf(row.status),
			cell: (row) => (
				<Badge variant={STUDENT_STATUS_BADGE[row.status]}>
					{t(`students.statuses.${row.status}`)}
				</Badge>
			),
		},
	];

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("students.title")}
				description={fillMessage(t("students.description"), {
					total: number.format(students.length),
				})}
			/>
			<MeterFigures items={figures} className={FIGURE_GRID} />
			<Card>
				<CardContent className={FIRST_COLUMN_ON_PHONE}>
					<DataTable
						rows={rows}
						columns={columns}
						searchText={(row) =>
							`${row.name} ${row.email} ${row.mainCourse.courseCode} ${row.mainCourse.courseTitle}`
						}
						noResults={t("students.noResults")}
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
			<StudentSheet
				studentId={openStudentId}
				onClose={() => void navigate({ search: {} })}
			/>
		</div>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8"];

/** Placeholder while the list loader runs: the header, the figures, and the table. */
export function StudentsPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-4 w-80 max-w-full" />
			</div>
			<MeterFiguresSkeleton count={3} className={FIGURE_GRID} />
			<Card>
				<CardContent className="grid gap-3">
					<Skeleton className="h-9 w-full sm:max-w-xs" />
					{SKELETON_ROWS.map((key) => (
						<Skeleton key={key} className="h-12 w-full" />
					))}
				</CardContent>
			</Card>
		</div>
	);
}

/** Error state of the list when the loader fails. Try again runs the loader again. */
export function StudentsPageError() {
	const { t } = useT();
	return <PageError message={t("students.loadError")} />;
}
