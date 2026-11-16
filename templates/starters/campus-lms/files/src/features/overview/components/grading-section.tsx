// Section 2 of the home digest: the submissions that wait for a grade, by waiting band, and the ones that wait longest.
// OverviewPage renders it. It reads the submission list of the assignments feature; the /app loader fills that cache.
// The queue does not depend on the period: it is the work to do today.
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { submissionsQueryOptions } from "~/features/assignments";
import {
	FRESH_WAIT_DAYS,
	fillMessage,
	GRADING_TARGET_DAYS,
	PersonAvatar,
	WAIT_BANDS,
	WaitBadge,
	type WaitBand,
	waitDaysOf,
} from "~/features/school";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { DigestSection } from "./digest-section";

// The section lists this many of the oldest submissions.
const OLDEST_COUNT = 5;

/**
 * The fill of each band in the share bar and its legend: blue, yellow, red, as the badge tones.
 * The middle band uses the theme yellow, because the warning token reads brown in a large fill.
 */
const WAIT_BAND_FILL = {
	fresh: "bg-info",
	waiting: "bg-chart-4",
	overdue: "bg-destructive",
} satisfies Record<WaitBand, string>;

// The bar and the legend show the longest wait first: that part needs the action.
const BANDS_BY_URGENCY = [...WAIT_BANDS].reverse();

/** The share bar has one part per band with rows. The list opens each submission on the Assignments page. */
export function GradingSection() {
	const { t, locale } = useT();
	const { data: submissions } = useSuspenseQuery(submissionsQueryOptions());
	const number = new Intl.NumberFormat(locale);
	const now = Date.now();

	// LIMIT: counts the queue in the browser from the full submission list. Upgrade: a SQL read function that counts per band.
	const waiting = submissions.filter((row) => row.status === "to_grade");
	const counts = BANDS_BY_URGENCY.map((band) => ({
		band,
		count: waiting.filter((row) => row.waitBand === band).length,
	}));
	// ISO texts in UTC sort like their times, so the first rows wait longest.
	const oldest = [...waiting]
		.sort((first, second) =>
			first.submittedAt.localeCompare(second.submittedAt),
		)
		.slice(0, OLDEST_COUNT);

	return (
		<DigestSection
			title={t("overview.gradingTitle")}
			figure={number.format(waiting.length)}
			description={t("overview.gradingDescription")}
			seeAllTo="/app/assignments"
			seeAllLabel={t("overview.seeAssignments")}
		>
			{waiting.length === 0 ? (
				<p className="text-muted-foreground text-sm">
					{t("overview.gradingEmpty")}
				</p>
			) : (
				<>
					<div className="grid gap-3">
						{/* The bar is decorative: the legend under it gives each count in words. */}
						<div
							aria-hidden="true"
							className="flex h-3 gap-0.5 overflow-hidden rounded-full"
						>
							{counts.map((part) =>
								part.count > 0 ? (
									<span
										key={part.band}
										className={WAIT_BAND_FILL[part.band]}
										style={{ width: `${(part.count / waiting.length) * 100}%` }}
									/>
								) : null,
							)}
						</div>
						<ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
							{counts.map((part) => (
								<li key={part.band} className="flex items-center gap-2">
									<span
										aria-hidden="true"
										className={cn(
											"size-2.5 rounded-full",
											WAIT_BAND_FILL[part.band],
										)}
									/>
									<span className="text-muted-foreground">
										{fillMessage(t(`grading.bands.${part.band}`), {
											fresh: number.format(FRESH_WAIT_DAYS),
											target: number.format(GRADING_TARGET_DAYS),
										})}
									</span>
									<span className="font-semibold tabular-nums">
										{number.format(part.count)}
									</span>
								</li>
							))}
						</ul>
					</div>
					<div className="grid gap-1">
						<h3 className="label-text text-muted-foreground text-sm">
							{t("overview.oldestFirst")}
						</h3>
						<ul className="divide-y divide-border/15">
							{oldest.map((row) => (
								<li key={row.id}>
									<Link
										to="/app/assignments"
										search={{ submission: row.id }}
										className="-mx-2 flex items-center gap-3 rounded-sm px-2 py-2.5 hover:bg-muted"
									>
										<PersonAvatar name={row.studentName} />
										<span className="grid min-w-0 flex-1">
											<span className="truncate font-medium text-sm">
												{row.studentName}
											</span>
											<span className="truncate text-muted-foreground text-xs">
												{`${row.assignmentTitle} · ${row.courseCode}`}
											</span>
										</span>
										{row.waitBand ? (
											<WaitBadge
												band={row.waitBand}
												days={waitDaysOf(row.submittedAt, now)}
											/>
										) : null}
									</Link>
								</li>
							))}
						</ul>
					</div>
				</>
			)}
		</DigestSection>
	);
}
