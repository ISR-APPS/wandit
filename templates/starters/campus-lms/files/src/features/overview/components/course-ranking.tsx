// The breakdown part of the "bars" chart form: the courses with the most finished lessons, as ranked bars.
// The lessons section of the home renders it under the trend. Each course row links to its course page.
// The bars are plain elements behind the title only. The value keeps its own column, clear of every bar.
import { Link } from "@tanstack/react-router";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import type { CourseActivity } from "../api/overview.queries";

type CourseRankingProps = {
	/** The top courses, largest first, then the optional "other" line with a null courseId. */
	courses: CourseActivity[];
};

/** The bar behind each row shows the share of the largest course. The "other" line has no bar. */
export function CourseRanking({ courses }: CourseRankingProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const largest = Math.max(
		0,
		...courses.flatMap((course) => (course.courseId ? [course.lessons] : [])),
	);

	if (courses.length === 0) {
		return (
			<p className="text-muted-foreground text-sm">
				{t("overview.noActivity")}
			</p>
		);
	}

	return (
		<ol className="grid gap-1.5">
			{courses.map((course, index) => {
				const content = (
					<>
						<span className="w-5 shrink-0 text-muted-foreground tabular-nums">
							{course.courseId ? number.format(index + 1) : ""}
						</span>
						<span className="relative flex min-w-0 flex-1 items-center self-stretch px-2">
							{/* start-0 makes the bar grow from the start side: from the right in Arabic. */}
							{/* The "other" line sums many courses, so a bar would rank it against single courses. */}
							{course.courseId ? (
								<span
									aria-hidden="true"
									className="absolute inset-y-1 start-0 rounded-sm bg-chart-1/20"
									style={{
										width: `${largest > 0 ? (course.lessons / largest) * 100 : 0}%`,
									}}
								/>
							) : null}
							<span className="relative truncate">
								{course.courseId ? course.title : t("overview.otherCourses")}
							</span>
						</span>
						<span className="w-10 shrink-0 text-end font-semibold tabular-nums">
							{number.format(course.lessons)}
						</span>
					</>
				);
				const rowClass = "flex h-10 items-center gap-2 px-2 text-sm";
				return (
					<li key={course.courseId ?? "other"}>
						{course.courseId ? (
							<Link
								to="/app/courses/$courseId"
								params={{ courseId: course.courseId }}
								className={cn(rowClass, "rounded-sm hover:bg-muted")}
							>
								{content}
							</Link>
						) : (
							<div className={cn(rowClass, "text-muted-foreground")}>
								{content}
							</div>
						)}
					</li>
				);
			})}
		</ol>
	);
}
