// Section 1 of the home digest: the lessons that students finished, per day, and the most active courses.
// OverviewPage renders it with the period of the page header. It reads two queries whose key holds the period.
// A period change keeps the old bars until the new ones arrive, so the section does not jump.
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { type PeriodDays, totalsOf } from "~/features/school";
import { useT } from "~/shared/i18n";
import {
	courseActivityQueryOptions,
	dailyLessonsQueryOptions,
} from "../api/overview.queries";
import { CourseRanking } from "./course-ranking";
import {
	DigestSection,
	DigestSectionError,
	DigestSectionSkeleton,
} from "./digest-section";
import { LessonsTrendChart } from "./lessons-trend-chart";

type LessonsSectionProps = {
	/** The period of the page, in days. */
	days: PeriodDays;
};

/** The h2 total is the sum of the bars, and its pill compares it with the period before. */
export function LessonsSection({ days }: LessonsSectionProps) {
	const { t, locale } = useT();
	const series = useQuery({
		...dailyLessonsQueryOptions(days),
		placeholderData: keepPreviousData,
	});
	const ranking = useQuery({
		...courseActivityQueryOptions(days),
		placeholderData: keepPreviousData,
	});

	if (series.isError || ranking.isError) {
		return (
			<DigestSectionError
				onRetry={() => {
					void series.refetch();
					void ranking.refetch();
				}}
			/>
		);
	}
	if (!series.data || !ranking.data) {
		return <DigestSectionSkeleton />;
	}

	const totals = totalsOf(series.data);
	return (
		<DigestSection
			title={t("overview.lessonsTitle")}
			figure={new Intl.NumberFormat(locale).format(totals.current)}
			change={totals.change}
			description={t("overview.lessonsDescription")}
			seeAllTo="/app/courses"
			seeAllLabel={t("overview.seeCourses")}
		>
			<LessonsTrendChart points={series.data} />
			<div className="grid gap-2">
				<h3 className="label-text text-muted-foreground text-sm">
					{t("overview.mostActive")}
				</h3>
				<CourseRanking courses={ranking.data} />
			</div>
		</DigestSection>
	);
}
