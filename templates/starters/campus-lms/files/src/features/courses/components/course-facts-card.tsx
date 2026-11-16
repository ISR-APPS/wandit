// The rail card of the course page with the facts of the course: the summary, the instructor, the classes, and the dates.
// CourseDetailPage renders it first in the rail. It reads only the course object that the page passes.
import {
	DISPLAY_CARD_TITLE,
	dateFormat,
	formatSchedule,
	PersonAvatar,
} from "~/features/school";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import type { CourseDetail } from "../api/courses.queries";

type CourseFactsCardProps = {
	/** The course of the page. */
	course: CourseDetail;
};

/** The dates show as one range, for example "Sep 14 – Nov 23, 2026". */
export function CourseFactsCard({ course }: CourseFactsCardProps) {
	const { t, locale } = useT();
	return (
		<Card className="gap-4">
			<CardHeader>
				<CardTitle className={DISPLAY_CARD_TITLE}>
					{t("courses.about")}
				</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-5">
				<p className="text-sm leading-relaxed">{course.summary}</p>
				<dl className="grid gap-4 text-sm">
					<div className="grid gap-1.5">
						<dt className="label-text text-muted-foreground">
							{t("courses.instructor")}
						</dt>
						<dd className="flex items-center gap-3">
							<PersonAvatar name={course.instructor.name} className="size-9" />
							<span className="grid">
								<span className="font-medium">{course.instructor.name}</span>
								<span className="text-muted-foreground text-xs">
									{course.instructor.title}
								</span>
							</span>
						</dd>
					</div>
					<div className="grid gap-1">
						<dt className="label-text text-muted-foreground">
							{t("courses.schedule")}
						</dt>
						<dd>
							{formatSchedule(course.classDays, course.classTime, locale)}
						</dd>
					</div>
					<div className="grid gap-1">
						<dt className="label-text text-muted-foreground">
							{t("courses.dates")}
						</dt>
						<dd className="tabular-nums">
							{dateFormat(locale).formatRange(
								new Date(course.startAt),
								new Date(course.endAt),
							)}
						</dd>
					</div>
				</dl>
			</CardContent>
		</Card>
	);
}
