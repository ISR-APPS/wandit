// The page of one course: the header, the meter figures of its state, the students and the assignments, then the facts, modules, and activity.
// The /app/courses/$courseId route renders it after its loader. The route also uses the skeleton below.
// An unknown id shows a not-found card with a button back to the list.
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { PageHeader } from "~/features/app-shell";
import {
	COURSE_STATUS_BADGE,
	calendarDaysFromNow,
	DISPLAY_CARD_TITLE,
	dateFormat,
	dayCountFormat,
	fillMessage,
	type MeterFigure,
	MeterFigures,
	MeterFiguresSkeleton,
	TrackTile,
} from "~/features/school";
import { type TranslationKey, useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { CaretLeftIcon } from "~/shared/ui/icons";
import { Skeleton } from "~/shared/ui/skeleton";
import { type CourseDetail, courseQueryOptions } from "../api/courses.queries";
import { CourseActivityCard } from "./course-activity-card";
import { CourseAssignmentsCard } from "./course-assignments-card";
import { CourseFactsCard } from "./course-facts-card";
import { CourseLearnersCard } from "./course-learners-card";
import { CourseModulesCard } from "./course-modules-card";

// Four figures: one per row on a phone, two up to a wide page, four on a wide one.
const FIGURE_GRID = "@md/main:grid-cols-2 @5xl/main:grid-cols-4";
// Three figures of a course that has not started: one per row on a phone, then three in a row.
const UPCOMING_FIGURE_GRID = "@2xl/main:grid-cols-3";

type CourseDetailPageProps = {
	/** The `$courseId` param of the URL: the slug of the course. The query treats an unknown slug as not found. */
	id: string;
};

/** A 2/3 main column and a 1/3 rail from the 5xl container width. */
export function CourseDetailPage({ id }: CourseDetailPageProps) {
	const { t, locale } = useT();
	const { data: course } = useSuspenseQuery(courseQueryOptions(id));

	const backLink = (
		<Button
			asChild
			variant="ghost"
			size="sm"
			className="-ms-3 justify-self-start max-sm:h-11"
		>
			<Link to="/app/courses">
				<CaretLeftIcon className="rtl:rotate-180" />
				{t("courses.back")}
			</Link>
		</Button>
	);
	if (!course) {
		return (
			<Card className="max-w-lg">
				<CardHeader>
					<CardTitle className={DISPLAY_CARD_TITLE}>
						{t("courses.notFoundTitle")}
					</CardTitle>
					<CardDescription>{t("courses.notFound")}</CardDescription>
				</CardHeader>
				<CardContent>
					<Button asChild variant="outline">
						<Link to="/app/courses">
							<CaretLeftIcon className="rtl:rotate-180" />
							{t("courses.backToList")}
						</Link>
					</Button>
				</CardContent>
			</Card>
		);
	}

	const figures = courseFigures(course, t, locale);

	return (
		<div className="grid gap-6">
			{backLink}
			<div className="flex items-start gap-4">
				<TrackTile track={course.track} className="size-14 [&_svg]:size-7" />
				<div className="min-w-0 flex-1">
					<PageHeader
						title={course.title}
						description={
							<span className="flex flex-wrap items-center gap-2">
								<Badge variant={COURSE_STATUS_BADGE[course.status]}>
									{t(`courses.statuses.${course.status}`)}
								</Badge>
								<span>
									{fillMessage(t("courses.meta"), {
										code: course.code,
										track: t(`tracks.${course.track}`),
										level: t(`levels.${course.level}`),
									})}
								</span>
							</span>
						}
					/>
				</div>
			</div>
			<MeterFigures
				items={figures}
				className={
					course.status === "upcoming" ? UPCOMING_FIGURE_GRID : FIGURE_GRID
				}
			/>
			<div className="grid @5xl/main:grid-cols-3 items-start gap-6">
				<div className="@5xl/main:col-span-2 grid min-w-0 gap-6">
					<CourseLearnersCard course={course} />
					<CourseAssignmentsCard course={course} />
				</div>
				<div className="grid min-w-0 gap-6">
					<CourseFactsCard course={course} />
					<CourseModulesCard modules={course.modules} />
					<CourseActivityCard events={course.events} />
				</div>
			</div>
		</div>
	);
}

// The figures of the course state. Before the first day, no lesson and no work exists, so meters of them stay empty.
function courseFigures(
	course: CourseDetail,
	t: (key: TranslationKey) => string,
	locale: string,
): MeterFigure[] {
	const number = new Intl.NumberFormat(locale);
	const seatsFilled: MeterFigure = {
		id: "seats-filled",
		label: t("courses.seatsFilled"),
		value: course.enrolled,
		whole: course.seats,
		wholeWords: t("courses.ofCapacity"),
		emptyWords: t("courses.noLearners"),
	};

	if (course.status === "upcoming") {
		return [
			seatsFilled,
			{
				id: "starts-in",
				label: t("courses.firstDayIn"),
				value: calendarDaysFromNow(course.startAt, Date.now()),
				emptyWords: fillMessage(t("courses.firstDayOn"), {
					date: dateFormat(locale).format(new Date(course.startAt)),
				}),
				format: dayCountFormat(locale),
			},
			{
				id: "lesson-count",
				label: t("courses.lessonCount"),
				value: course.lessonCount,
				emptyWords: fillMessage(t("courses.lessonCountNote"), {
					modules: number.format(course.modules.length),
					weeks: number.format(course.weeks),
				}),
			},
		];
	}

	// After the last day every lesson is open, so the certificates replace the open lessons.
	const secondFigure: MeterFigure =
		course.status === "completed"
			? {
					id: "certified",
					label: t("courses.certifiedLabel"),
					value: course.certificates,
					whole: course.enrolled,
					wholeWords: t("courses.ofStudents"),
					emptyWords: t("courses.noLearners"),
				}
			: {
					id: "lessons-open",
					label: t("courses.lessonsReleased"),
					value: course.lessonsReleased,
					whole: course.lessonCount,
					wholeWords: t("courses.ofTheCourse"),
					emptyWords: t("courses.noLessonOpen"),
				};
	return [
		seatsFilled,
		secondFigure,
		{
			id: "lessons-done",
			label: t("courses.lessonsDone"),
			value: course.lessonsDone,
			// The open lessons of all students.
			whole: course.lessonsReleased * course.enrolled,
			wholeWords: t("courses.ofOpenLessons"),
			emptyWords: t("courses.noLessonOpen"),
		},
		{
			id: "work-graded",
			label: t("courses.workGraded"),
			value: course.graded,
			whole: course.submissions,
			wholeWords: t("courses.ofSubmissions"),
			emptyWords: t("courses.noSubmission"),
		},
	];
}

/** Placeholder while the detail loader runs: the back link, the header, the figures, and the two columns. */
export function CourseDetailPageSkeleton() {
	return (
		<div className="grid gap-6">
			<Skeleton className="h-8 w-28" />
			<div className="flex items-start gap-4">
				<Skeleton className="size-14 rounded-control" />
				<div className="grid gap-2">
					<Skeleton className="h-8 w-72 max-w-full" />
					<Skeleton className="h-5 w-48" />
				</div>
			</div>
			<MeterFiguresSkeleton count={4} className={FIGURE_GRID} />
			<div className="grid @5xl/main:grid-cols-3 items-start gap-6">
				<Skeleton className="@5xl/main:col-span-2 h-96 rounded-surface" />
				<Skeleton className="h-72 rounded-surface" />
			</div>
		</div>
	);
}
