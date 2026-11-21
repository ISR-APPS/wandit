// The Students page behind login, in the layout of the kit users page: the title with an export button,
// then a filter field, the Status, Track, and Course filters, the column menu, and the table with its pages.
// The /app/students route renders it after its loader. `?student=<id>` opens the record of one student in a side panel.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	type CsvColumn,
	copyToClipboard,
	downloadCsv,
	fillMessage,
	PageError,
	PersonAvatar,
	STUDENT_STATUS_BADGE,
	STUDENT_STATUSES,
	TRACKS,
	toCsv,
} from "~/features/school";
import { type TranslationKey, useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import {
	type RecordColumn,
	RecordFilter,
	RecordTable,
} from "~/shared/ui/record-table";
import { Skeleton } from "~/shared/ui/skeleton";
import { type Student, studentsQueryOptions } from "../api/students.queries";
import { StudentSheet } from "./student-sheet";

// The route of this page. Its search param holds the open student.
const studentsRoute = getRouteApi("/app/students");

// Ten rows per page, as the kit users page.
const PAGE_SIZE = 10;

// The CSV columns of the student list. The page export and the bulk export use them.
function studentCsvColumns(
	t: (key: TranslationKey) => string,
): CsvColumn<Student>[] {
	return [
		{ header: t("students.student"), value: (row) => row.name },
		{ header: t("students.email"), value: (row) => row.email },
		{ header: t("students.course"), value: (row) => row.mainCourse.courseCode },
		{
			header: t("students.track"),
			value: (row) => t(`tracks.${row.mainCourse.courseTrack}`),
		},
		{
			header: t("students.grade"),
			value: (row) =>
				row.averageGrade === null ? "" : String(Math.round(row.averageGrade)),
		},
		{
			header: t("students.status"),
			value: (row) => t(`students.statuses.${row.status}`),
		},
	];
}

/** The three filters narrow the rows; then RecordTable searches, sorts, selects, and pages them. */
export function StudentsPage() {
	const { t, locale } = useT();
	const { student: openStudentId } = studentsRoute.useSearch();
	const navigate = studentsRoute.useNavigate();
	const { data: students } = useSuspenseQuery(studentsQueryOptions());
	const [status, setStatus] = useState<string | null>(null);
	const [track, setTrack] = useState<string | null>(null);
	const [courseCode, setCourseCode] = useState<string | null>(null);
	const number = new Intl.NumberFormat(locale);
	const rows = students.filter(
		(student) =>
			(status === null || student.status === status) &&
			(track === null || student.mainCourse.courseTrack === track) &&
			(courseCode === null || student.mainCourse.courseCode === courseCode),
	);
	const courseCodes = [
		...new Set(students.map((student) => student.mainCourse.courseCode)),
	].sort();

	const columns: RecordColumn<Student>[] = [
		{
			id: "name",
			header: t("students.student"),
			sortValue: (row) => row.name,
			cell: (row) => (
				<button
					type="button"
					onClick={() => void navigate({ search: { student: row.id } })}
					className="flex items-center gap-3 text-start hover:underline"
				>
					<PersonAvatar name={row.name} className="size-8" />
					<span className="font-medium">{row.name}</span>
				</button>
			),
		},
		{
			id: "course",
			header: t("students.course"),
			sortValue: (row) => row.mainCourse.courseTitle,
			hideable: true,
			cell: (row) => row.mainCourse.courseTitle,
		},
		{
			id: "track",
			header: t("students.track"),
			sortValue: (row) => row.mainCourse.courseTrack,
			hideable: true,
			cell: (row) => t(`tracks.${row.mainCourse.courseTrack}`),
		},
		{
			id: "email",
			header: t("students.email"),
			sortValue: (row) => row.email,
			hideable: true,
			cell: (row) => row.email,
		},
		{
			id: "grade",
			header: t("students.grade"),
			sortValue: (row) => row.averageGrade ?? -1,
			hideable: true,
			cell: (row) =>
				row.averageGrade === null
					? "–"
					: number.format(Math.round(row.averageGrade)),
		},
		{
			id: "status",
			header: t("students.status"),
			sortValue: (row) => row.status,
			hideable: true,
			cell: (row) => (
				<Badge variant={STUDENT_STATUS_BADGE[row.status]}>
					{t(`students.statuses.${row.status}`)}
				</Badge>
			),
		},
	];

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("students.title")}
				description={fillMessage(t("students.description"), {
					total: number.format(students.length),
				})}
				actions={
					<Button
						type="button"
						aria-label={t("common.exportCsv")}
						onClick={() =>
							downloadCsv("students.csv", toCsv(rows, studentCsvColumns(t)))
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
					`${row.name} ${row.email} ${row.mainCourse.courseCode} ${row.mainCourse.courseTitle}`
				}
				searchPlaceholder={t("students.search")}
				toolbar={
					<>
						<RecordFilter
							label={t("students.status")}
							options={STUDENT_STATUSES.map((value) => ({
								value,
								label: t(`students.statuses.${value}`),
							}))}
							value={status}
							onValueChange={setStatus}
						/>
						<RecordFilter
							label={t("students.track")}
							options={TRACKS.map((value) => ({
								value,
								label: t(`tracks.${value}`),
							}))}
							value={track}
							onValueChange={setTrack}
						/>
						<RecordFilter
							label={t("students.course")}
							options={courseCodes.map((value) => ({ value, label: value }))}
							value={courseCode}
							onValueChange={setCourseCode}
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
								"students-selected.csv",
								toCsv(selected, studentCsvColumns(t)),
							)
						}
					>
						<DownloadSimpleIcon />
						{t("table.exportSelected")}
					</Button>
				)}
				rowMenu={(row) => (
					<>
						<DropdownMenuItem
							onSelect={() => void navigate({ search: { student: row.id } })}
						>
							{t("students.openRecord")}
						</DropdownMenuItem>
						<DropdownMenuItem
							onSelect={() =>
								copyToClipboard(row.email, {
									done: t("table.emailCopied"),
									failed: t("table.copyFailed"),
								})
							}
						>
							{t("table.copyEmail")}
						</DropdownMenuItem>
					</>
				)}
				pageSize={PAGE_SIZE}
				noResults={t("students.noResults")}
			/>
			<StudentSheet
				studentId={openStudentId}
				onClose={() => void navigate({ search: {} })}
			/>
		</div>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

/** Placeholder while the list loader runs: the header, the toolbar, and the table. */
export function StudentsPageSkeleton() {
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

/** Error state of the list when the loader fails. Try again runs the loader again. */
export function StudentsPageError() {
	const { t } = useT();
	return <PageError message={t("students.loadError")} />;
}
