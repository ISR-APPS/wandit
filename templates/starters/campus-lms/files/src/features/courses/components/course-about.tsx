// The text part of the Courses page: "About the course" with the summary and the class facts,
// then "What students learn" with the modules as a bullet list. CoursesPage renders it under the instructor row.
import { dateFormat, fillMessage, formatSchedule } from "~/features/school";
import { useT } from "~/shared/i18n";
import type { CourseDetail } from "../api/courses.queries";

type CourseAboutProps = {
	/** The chosen course with its summary and modules, from the course query. */
	course: CourseDetail;
};

/** Two sections with an h2 each, on the page ground as in the kit. */
export function CourseAbout({ course }: CourseAboutProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const dates = dateFormat(locale);

	return (
		<div className="grid gap-6">
			<section className="grid gap-3">
				<h2 className="font-semibold text-lg">{t("courses.about")}</h2>
				<p className="text-muted-foreground leading-relaxed">
					{course.summary}
				</p>
				<p className="text-muted-foreground text-sm">
					{[
						formatSchedule(course.classDays, course.classTime, locale),
						fillMessage(t("courses.length"), {
							weeks: number.format(course.weeks),
							lessons: number.format(course.lessonCount),
						}),
						`${dates.format(new Date(course.startAt))} – ${dates.format(new Date(course.endAt))}`,
					].join(" · ")}
				</p>
			</section>
			<section className="grid gap-3">
				<h2 className="font-semibold text-lg">{t("courses.learn")}</h2>
				<ul className="grid gap-2 text-muted-foreground">
					{course.modules.map((module) => (
						<li key={module.title} className="flex items-start gap-2">
							<span
								aria-hidden="true"
								className="mt-2 size-1.5 shrink-0 rounded-full bg-current"
							/>
							<span>{module.title}</span>
						</li>
					))}
				</ul>
			</section>
		</div>
	);
}
