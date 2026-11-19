// The large panel at the top of the Courses page: the chosen course on a tint of the chart tokens,
// with a bar at the bottom that holds the open button, the week, and the open lessons.
// CoursesPage renders it where the kit course page shows its video player. It reads only its props.
import { PlayIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { COURSE_STATUS_BADGE, fillMessage, TrackTile } from "~/features/school";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { Progress } from "~/shared/ui/progress";
import type { Course } from "../api/courses.queries";

type CourseSpotlightProps = {
	/** The chosen course of the page. */
	course: Course;
};

/**
 * 16:9 like the kit player from the @xl/main width. On a phone the ratio is off and the panel keeps 256 px of height.
 * min-w-0 lets the grid column shrink. The bottom bar sits on the card color, so its text keeps its contrast.
 */
export function CourseSpotlight({ course }: CourseSpotlightProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const lessons = fillMessage(t("courses.lessonsOpen"), {
		released: number.format(course.lessonsReleased),
		total: number.format(course.lessonCount),
	});

	return (
		<div className="relative flex @xl/main:aspect-video min-h-64 min-w-0 flex-col justify-between overflow-hidden rounded-surface border bg-linear-to-br from-chart-1/45 via-chart-2/30 to-chart-4/45 @xl/main:p-6 p-4">
			<div className="flex flex-wrap items-center gap-2">
				<Badge variant={COURSE_STATUS_BADGE[course.status]} className="bg-card">
					{t(`courses.statuses.${course.status}`)}
				</Badge>
				<Badge variant="outline" className="bg-card">
					{course.code}
				</Badge>
			</div>
			<TrackTile
				track={course.track}
				className="mx-auto @xl/main:size-28 size-20 rounded-full bg-card/70 @xl/main:[&_svg]:size-14 [&_svg]:size-10"
			/>
			<div className="flex items-center gap-3 rounded-md bg-card/90 p-3">
				<Button size="icon" asChild>
					<Link
						to="/app/courses/$courseId"
						params={{ courseId: course.id }}
						aria-label={fillMessage(t("courses.openCourse"), {
							title: course.title,
						})}
					>
						<PlayIcon className="rtl:rotate-180" />
					</Link>
				</Button>
				<div className="grid min-w-0 flex-1 gap-1.5">
					<div className="flex items-center justify-between gap-3 text-sm">
						<span className="truncate font-medium">{course.title}</span>
						<span className="shrink-0 text-muted-foreground tabular-nums">
							{course.status === "upcoming"
								? t("courses.statuses.upcoming")
								: fillMessage(t("courses.weekOf"), {
										week: number.format(course.week),
										weeks: number.format(course.weeks),
									})}
						</span>
					</div>
					<Progress
						value={course.lessonsReleased}
						max={course.lessonCount}
						aria-label={lessons}
						title={lessons}
						className="h-1.5"
					/>
				</div>
			</div>
		</div>
	);
}
