// The progress card of the Courses page: the share of open lessons of the chosen course, four milestone dots,
// and one sentence about the students. CoursesPage renders it first in the end column.
import { dateFormat, fillMessage, shareFormat } from "~/features/school";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";
import type { CourseDetail } from "../api/courses.queries";

// The milestone dots of the kit card, in percent of the lessons.
const MILESTONES = [25, 50, 75, 100] as const;

type CourseProgressCardProps = {
	/** The chosen course with its students, from the course query. */
	course: CourseDetail;
};

/** The sentence depends on the state of the course: behind students, free seats, or certificates. */
export function CourseProgressCard({ course }: CourseProgressCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const share =
		course.lessonCount === 0 ? 0 : course.lessonsReleased / course.lessonCount;
	const students = number.format(course.learners.length);
	const message =
		course.status === "running"
			? fillMessage(t("courses.progressRunning"), {
					week: number.format(course.week),
					weeks: number.format(course.weeks),
					behind: number.format(
						course.learners.filter((learner) => learner.state === "behind")
							.length,
					),
					students,
				})
			: course.status === "upcoming"
				? fillMessage(t("courses.progressUpcoming"), {
						date: dateFormat(locale).format(new Date(course.startAt)),
						enrolled: number.format(course.enrolled),
						seats: number.format(course.seats),
					})
				: fillMessage(t("courses.progressCompleted"), {
						date: dateFormat(locale).format(new Date(course.endAt)),
						certified: number.format(course.certificates),
						students,
					});

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					{t("courses.progressTitle")}
					<Badge variant="outline" className="tabular-nums">
						{shareFormat(locale).format(share)}
					</Badge>
				</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-4">
				<Progress
					value={course.lessonsReleased}
					max={course.lessonCount}
					aria-label={t("courses.lessonsReleased")}
					className="bg-primary/20 [&>[data-slot=progress-indicator]]:bg-primary"
				/>
				{/* Decorative: the badge above gives the share in words. */}
				<div aria-hidden="true" className="flex items-center justify-between">
					{MILESTONES.map((milestone) => (
						<span
							key={milestone}
							className={cn(
								"flex size-8 items-center justify-center rounded-full font-medium text-xs tabular-nums",
								share * 100 >= milestone
									? "bg-primary text-primary-foreground"
									: "bg-muted text-muted-foreground",
							)}
						>
							{number.format(milestone)}
						</span>
					))}
				</div>
				<p className="rounded-md bg-muted/50 p-3 text-muted-foreground text-sm">
					{message}
				</p>
			</CardContent>
		</Card>
	);
}
