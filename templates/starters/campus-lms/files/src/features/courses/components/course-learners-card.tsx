// The students of one course as a sortable table: the state, the lessons done, the mean grade, and the last activity.
// CourseDetailPage renders it in the main column. Each name opens the record of the student on the Students page.
// The lesson figure compares with the open lessons, so a student is never "behind" on lessons that are not open.
import { Link } from "@tanstack/react-router";
import {
	DISPLAY_CARD_TITLE,
	FIRST_COLUMN_ON_PHONE,
	fillMessage,
	formatRelativeTime,
	LEARNER_STATE_BADGE,
	LEARNER_STATES,
	PersonAvatar,
} from "~/features/school";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { DataTable, type DataTableColumn } from "~/shared/ui/data-table";
import type { CourseDetail, Learner } from "../api/courses.queries";

type CourseLearnersCardProps = {
	/** The course of the page, with its learners. */
	course: CourseDetail;
};

/** The table has no search: a course has at most a few dozen students. The headers sort. */
export function CourseLearnersCard({ course }: CourseLearnersCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const now = Date.now();
	// The whole of the lesson figure: all lessons after the last day, the open ones before.
	const lessonWhole =
		course.status === "completed" ? course.lessonCount : course.lessonsReleased;
	// Before the first day no lesson is open, so "0 / 0" would say nothing.
	const lessonsOf = (row: Learner) =>
		course.status === "upcoming"
			? "—"
			: fillMessage(t("courses.lessonsShort"), {
					done: number.format(row.done),
					total: number.format(lessonWhole),
				});

	const columns: DataTableColumn<Learner>[] = [
		{
			id: "name",
			header: t("courses.student"),
			sortValue: (row) => row.name,
			// On a phone this is the only column, so it also shows the state and the lessons.
			cell: (row) => (
				<Link
					to="/app/students"
					search={{ student: row.id }}
					className="flex items-center gap-3"
				>
					<PersonAvatar name={row.name} />
					<span className="grid justify-items-start gap-1">
						<span className="font-medium hover:underline">{row.name}</span>
						<span className="@2xl/main:block hidden text-muted-foreground text-xs">
							{row.email}
						</span>
						<span className="flex @2xl/main:hidden items-center gap-2">
							<Badge variant={LEARNER_STATE_BADGE[row.state]}>
								{t(`learners.states.${row.state}`)}
							</Badge>
							<span className="text-muted-foreground text-xs tabular-nums">
								{lessonsOf(row)}
							</span>
						</span>
					</span>
				</Link>
			),
		},
		{
			id: "state",
			header: t("courses.state"),
			sortValue: (row) => LEARNER_STATES.indexOf(row.state),
			cell: (row) => (
				<Badge variant={LEARNER_STATE_BADGE[row.state]}>
					{t(`learners.states.${row.state}`)}
				</Badge>
			),
		},
		{
			id: "lessons",
			header: t("courses.progress"),
			align: "end",
			sortValue: (row) => row.done,
			cell: lessonsOf,
		},
		{
			id: "grade",
			header: t("courses.average"),
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
			id: "active",
			header: t("courses.lastActive"),
			align: "end",
			sortValue: (row) => (row.lastActiveAt ? Date.parse(row.lastActiveAt) : 0),
			cell: (row) => (
				<span className="whitespace-nowrap text-muted-foreground">
					{row.lastActiveAt
						? formatRelativeTime(row.lastActiveAt, now, locale)
						: t("courses.never")}
				</span>
			),
		},
	];

	return (
		<Card>
			<CardHeader>
				<CardTitle className={DISPLAY_CARD_TITLE}>
					{fillMessage(t("courses.learnersCount"), {
						count: number.format(course.learners.length),
					})}
				</CardTitle>
				<CardDescription>{t("courses.learnersDescription")}</CardDescription>
			</CardHeader>
			<CardContent className={FIRST_COLUMN_ON_PHONE}>
				{course.learners.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("courses.noLearners")}
					</p>
				) : (
					<DataTable
						rows={course.learners}
						columns={columns}
						noResults={t("courses.noLearners")}
					/>
				)}
			</CardContent>
		</Card>
	);
}
