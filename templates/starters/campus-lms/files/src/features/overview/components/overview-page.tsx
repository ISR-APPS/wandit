// The home behind login: the digest of the school for one period, read from top to bottom like a letter.
// The /app route renders it after its loader. The route also uses the skeleton and the error below.
// It holds the period. The summary, the lessons section, and the enrollments section read it; the grading queue does not.
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	dayCountFormat,
	fillMessage,
	PageError,
	PERIOD_DAYS,
	type PeriodDays,
} from "~/features/school";
import { useT } from "~/shared/i18n";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { DigestSectionSkeleton } from "./digest-section";
import { DigestSummary, DigestSummarySkeleton } from "./digest-summary";
import { EnrollmentsSection } from "./enrollments-section";
import { GradingSection } from "./grading-section";
import { LessonsSection } from "./lessons-section";

/** 7 days: a digest reads one week. The /app loader prefetches this period. */
export const DEFAULT_DAYS: PeriodDays = 7;

// One column at every width, as the digest home asks. 60rem keeps the lines of the summary short.
const COLUMN = "mx-auto flex w-full max-w-[60rem] flex-col gap-8";

/** The period title, the summary, then the three sections in one column. */
export function OverviewPage() {
	const { t, locale } = useT();
	const [days, setDays] = useState<PeriodDays>(DEFAULT_DAYS);
	const dayCount = dayCountFormat(locale);
	const today = new Intl.DateTimeFormat(locale, {
		weekday: "long",
		month: "long",
		day: "numeric",
	}).format(new Date());

	return (
		<div className={COLUMN}>
			<div className="grid gap-5">
				<PageHeader
					title={fillMessage(t("overview.title"), {
						days: dayCount.format(days),
					})}
					description={fillMessage(t("overview.description"), {
						date: today,
					})}
					actions={
						<Tabs
							value={String(days)}
							onValueChange={(value) =>
								setDays(
									PERIOD_DAYS.find((option) => String(option) === value) ??
										DEFAULT_DAYS,
								)
							}
						>
							{/* 44 px on a phone: the touch area of the brief. */}
							<TabsList
								aria-label={t("chart.period")}
								className="max-sm:group-data-[orientation=horizontal]/tabs:h-11"
							>
								{PERIOD_DAYS.map((option) => (
									<TabsTrigger key={option} value={String(option)}>
										{dayCount.format(option)}
									</TabsTrigger>
								))}
							</TabsList>
						</Tabs>
					}
				/>
				<DigestSummary days={days} />
			</div>
			<LessonsSection days={days} />
			<GradingSection />
			<EnrollmentsSection days={days} />
		</div>
	);
}

/** Placeholder while the home loader runs: the header, the summary lines, and two sections. */
export function OverviewPageSkeleton() {
	return (
		<div className={COLUMN}>
			<div className="grid gap-5">
				<div className="flex flex-wrap items-end justify-between gap-3">
					<div className="grid gap-2">
						<Skeleton className="h-8 w-40" />
						<Skeleton className="h-4 w-64" />
					</div>
					<Skeleton className="h-9 w-60" />
				</div>
				<DigestSummarySkeleton />
			</div>
			<DigestSectionSkeleton />
			<DigestSectionSkeleton />
		</div>
	);
}

/** Error state of the home when the loader fails. Try again runs the loader again. */
export function OverviewPageError() {
	const { t } = useT();
	return <PageError message={t("overview.loadError")} />;
}
