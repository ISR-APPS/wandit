// The assignment table of the course page: every assignment with its kind, due day, turned-in and graded counts,
// and the mean grade. CourseDetailPage renders it in the Assignments tab.
import { dateFormat } from "~/features/school";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Card, CardContent } from "~/shared/ui/card";
import { type RecordColumn, RecordTable } from "~/shared/ui/record-table";
import type { CourseAssignment } from "../api/courses.queries";
import { AssignmentStateBadge } from "./assignment-state-badge";

type CourseWorkTableProps = {
	assignments: CourseAssignment[];
	/** Count of students in the course: the end of each turned-in count. */
	enrolled: number;
};

/** A course has a few assignments, so the table has no search and one page. */
export function CourseWorkTable({
	assignments,
	enrolled,
}: CourseWorkTableProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const dates = dateFormat(locale);

	const columns: RecordColumn<CourseAssignment>[] = [
		{
			id: "title",
			header: t("courses.assignment"),
			sortValue: (row) => row.title,
			cell: (row) => (
				<div className="flex items-center gap-2">
					<Badge variant="outline">{t(`assignments.kinds.${row.kind}`)}</Badge>
					<span className="font-medium">{row.title}</span>
				</div>
			),
		},
		{
			id: "state",
			header: t("courses.state"),
			sortValue: (row) => row.state,
			cell: (row) => <AssignmentStateBadge state={row.state} />,
		},
		{
			id: "due",
			header: t("courses.due"),
			sortValue: (row) => row.dueAt,
			cell: (row) => (
				<span className="tabular-nums">
					{dates.format(new Date(row.dueAt))}
				</span>
			),
		},
		{
			id: "turnedIn",
			header: t("courses.turnedIn"),
			align: "end",
			sortValue: (row) => row.submitted,
			cell: (row) =>
				`${number.format(row.submitted)}/${number.format(enrolled)}`,
		},
		{
			id: "graded",
			header: t("courses.graded"),
			align: "end",
			sortValue: (row) => row.graded,
			cell: (row) => number.format(row.graded),
		},
		{
			id: "average",
			header: t("courses.average"),
			align: "end",
			sortValue: (row) => row.averagePoints ?? -1,
			cell: (row) =>
				row.averagePoints === null
					? "–"
					: number.format(Math.round(row.averagePoints)),
		},
	];

	return (
		<Card>
			<CardContent>
				<RecordTable
					rows={assignments}
					columns={columns}
					pageSize={10}
					noResults={t("courses.noAssignments")}
				/>
			</CardContent>
		</Card>
	);
}
