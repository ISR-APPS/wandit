// The student table of the course page: every student of the course with the state, the lessons, and the grade.
// CourseDetailPage renders it in the Students tab. The row menu opens the record of the student on the Students page.
// "Export selected" downloads the chosen rows as CSV with learnerCsvColumns.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import {
	type CsvColumn,
	copyToClipboard,
	downloadCsv,
	formatRelativeTime,
	LEARNER_STATE_BADGE,
	PersonAvatar,
	toCsv,
} from "~/features/school";
import { type TranslationKey, useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import { Progress } from "~/shared/ui/progress";
import { type RecordColumn, RecordTable } from "~/shared/ui/record-table";
import type { Learner } from "../api/courses.queries";

/** The CSV columns of a student list. The page export and the bulk export use them. */
export function learnerCsvColumns(
	t: (key: TranslationKey) => string,
	lessonCount: number,
): CsvColumn<Learner>[] {
	return [
		{ header: t("courses.student"), value: (row) => row.name },
		{ header: t("courses.email"), value: (row) => row.email },
		{
			header: t("courses.state"),
			value: (row) => t(`learners.states.${row.state}`),
		},
		{
			header: t("courses.progress"),
			value: (row) => `${row.done}/${lessonCount}`,
		},
		{
			header: t("courses.average"),
			value: (row) =>
				row.averageGrade === null ? "" : String(Math.round(row.averageGrade)),
		},
	];
}

type CourseLearnersTableProps = {
	learners: Learner[];
	/** Count of all lessons of the course: the end of each progress bar. */
	lessonCount: number;
	/** The course code, for the name of the CSV file. */
	courseCode: string;
};

/** Ten rows per page, with search, sort, row selection, and a row menu. */
export function CourseLearnersTable({
	learners,
	lessonCount,
	courseCode,
}: CourseLearnersTableProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const now = Date.now();

	const columns: RecordColumn<Learner>[] = [
		{
			id: "name",
			header: t("courses.student"),
			sortValue: (row) => row.name,
			cell: (row) => (
				<div className="flex items-center gap-3">
					<PersonAvatar name={row.name} className="size-8" />
					<div className="grid min-w-0">
						<span className="truncate font-medium">{row.name}</span>
						<span className="truncate text-muted-foreground text-xs">
							{row.email}
						</span>
					</div>
				</div>
			),
		},
		{
			id: "state",
			header: t("courses.state"),
			sortValue: (row) => row.state,
			hideable: true,
			cell: (row) => (
				<Badge variant={LEARNER_STATE_BADGE[row.state]}>
					{t(`learners.states.${row.state}`)}
				</Badge>
			),
		},
		{
			id: "lessons",
			header: t("courses.progress"),
			sortValue: (row) => row.done,
			hideable: true,
			cell: (row) => (
				<div className="flex items-center gap-2">
					<Progress
						value={row.done}
						max={lessonCount}
						aria-hidden="true"
						className="w-16"
					/>
					<span className="text-muted-foreground text-xs tabular-nums">
						{`${number.format(row.done)}/${number.format(lessonCount)}`}
					</span>
				</div>
			),
		},
		{
			id: "grade",
			header: t("courses.average"),
			align: "end",
			sortValue: (row) => row.averageGrade ?? -1,
			hideable: true,
			cell: (row) =>
				row.averageGrade === null
					? "–"
					: number.format(Math.round(row.averageGrade)),
		},
		{
			id: "lastActive",
			header: t("courses.lastActive"),
			sortValue: (row) => row.lastActiveAt ?? "",
			hideable: true,
			cell: (row) => (
				<span className="text-muted-foreground text-sm">
					{row.lastActiveAt === null
						? t("courses.never")
						: formatRelativeTime(row.lastActiveAt, now, locale)}
				</span>
			),
		},
	];

	return (
		<Card>
			<CardContent>
				<RecordTable
					rows={learners}
					columns={columns}
					searchText={(row) => `${row.name} ${row.email}`}
					searchPlaceholder={t("courses.searchStudents")}
					selectable
					bulkActions={(selected) => (
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="h-9"
							onClick={() =>
								downloadCsv(
									`${courseCode}-students-selected.csv`,
									toCsv(selected, learnerCsvColumns(t, lessonCount)),
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
								<Link to="/app/students" search={{ student: row.id }}>
									{t("courses.openRecord")}
								</Link>
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
					pageSize={10}
					noResults={t("courses.noLearnerMatch")}
				/>
			</CardContent>
		</Card>
	);
}
