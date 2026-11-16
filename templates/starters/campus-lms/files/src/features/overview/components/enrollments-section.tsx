// Section 3 of the home digest: the new enrollments per day as a mini trend, and the newest enrollments.
// OverviewPage renders it with the period of the page header. The trend key holds the period; the newest list does not.
// Each row opens the record of the student on the Students page.
import {
	keepPreviousData,
	useQuery,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
	fillMessage,
	formatRelativeTime,
	type PeriodDays,
	PersonAvatar,
	totalsOf,
} from "~/features/school";
import { useT } from "~/shared/i18n";
import {
	dailyEnrollmentsQueryOptions,
	newestEnrollmentsQueryOptions,
} from "../api/overview.queries";
import {
	DigestSection,
	DigestSectionError,
	DigestSectionSkeleton,
} from "./digest-section";
import { EnrollmentsStripChart } from "./enrollments-strip-chart";

type EnrollmentsSectionProps = {
	/** The period of the page, in days. */
	days: PeriodDays;
};

/** The h2 total is the sum of the strip, and its pill compares it with the period before. */
export function EnrollmentsSection({ days }: EnrollmentsSectionProps) {
	const { t, locale } = useT();
	const series = useQuery({
		...dailyEnrollmentsQueryOptions(days),
		placeholderData: keepPreviousData,
	});
	const { data: newest } = useSuspenseQuery(newestEnrollmentsQueryOptions());
	const now = Date.now();

	if (series.isError) {
		return <DigestSectionError onRetry={() => void series.refetch()} />;
	}
	if (!series.data) {
		return <DigestSectionSkeleton />;
	}

	const totals = totalsOf(series.data);
	return (
		<DigestSection
			title={t("overview.enrollmentsTitle")}
			figure={new Intl.NumberFormat(locale).format(totals.current)}
			change={totals.change}
			description={t("overview.enrollmentsDescription")}
			seeAllTo="/app/students"
			seeAllLabel={t("overview.seeStudents")}
		>
			<EnrollmentsStripChart points={series.data} />
			<div className="grid gap-1">
				<h3 className="label-text text-muted-foreground text-sm">
					{t("overview.newest")}
				</h3>
				<ul className="grid @xl/main:grid-cols-2 gap-x-6">
					{newest.map((row) => (
						<li key={row.id} className="border-border/15 border-b">
							<Link
								to="/app/students"
								search={{ student: row.studentId }}
								className="-mx-2 flex items-center gap-3 rounded-sm px-2 py-2.5 hover:bg-muted"
							>
								<PersonAvatar name={row.studentName} />
								<span className="grid min-w-0 flex-1">
									<span className="truncate font-medium text-sm">
										{row.studentName}
									</span>
									<span className="truncate text-muted-foreground text-xs">
										{fillMessage(t("overview.joined"), {
											course: row.courseTitle,
										})}
									</span>
								</span>
								<span className="shrink-0 text-muted-foreground text-xs">
									{formatRelativeTime(row.enrolledAt, now, locale)}
								</span>
							</Link>
						</li>
					))}
				</ul>
			</div>
		</DigestSection>
	);
}
