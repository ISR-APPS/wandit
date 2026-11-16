// Section 3 of the digest, the second activity: applications to the open positions in the period.
// OverviewPage renders it with the daily application series and the candidate list.
// A lazy mini bar trend shows one bar per day. The newest applications follow, each with its source.
import { Link } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import type { Candidate } from "~/features/hiring";
import {
	type DailyPoint,
	formatRelativeTime,
	PersonAvatar,
	totalsOf,
} from "~/features/people";
import { useT } from "~/shared/i18n";
import { Card, CardContent } from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import { DigestSectionHeader } from "./digest-section-header";

// The digest lists the newest applications, at most this many.
const LISTED_CANDIDATES = 4;

// recharts weighs about 330 kB. The lazy chunk keeps it out of the first script of every page.
const ApplicationsTrendChart = lazy(() => import("./applications-trend-chart"));

type HiringSectionProps = {
	/** Applications per day in the period, oldest first. */
	points: DailyPoint[];
	/** Every candidate, newest application first. */
	candidates: Candidate[];
};

/** The hiring section: the application total, a mini trend, and the newest applications. */
export function HiringSection({ points, candidates }: HiringSectionProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const { current } = totalsOf(points);
	const now = Date.now();
	const newest = candidates.slice(0, LISTED_CANDIDATES);

	return (
		<Card className="gap-5">
			<DigestSectionHeader
				title={t("overview.applicationsTitle")}
				figure={number.format(current)}
				figureLabel={t("overview.applicationsUnit")}
				to="/app/hiring"
				linkLabel={t("overview.seeHiring")}
				description={t("overview.applicationsDescription")}
			/>
			<CardContent className="grid gap-5">
				<Suspense fallback={<Skeleton className="h-28 w-full" />}>
					<ApplicationsTrendChart points={points} />
				</Suspense>
				<ul className="grid divide-y divide-border">
					{newest.map((candidate) => (
						<li key={candidate.id}>
							<Link
								to="/app/hiring"
								search={{
									position: candidate.positionId,
									candidate: candidate.id,
								}}
								className="-mx-2 grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-0.5 rounded-control px-2 py-3 hover:bg-muted"
							>
								<PersonAvatar name={candidate.name} className="row-span-2" />
								<span className="truncate font-medium text-sm">
									{candidate.name}
								</span>
								{/* The newest rows are all at the "applied" stage, so the source tells more. */}
								<span className="text-muted-foreground text-xs">
									{t(`sources.${candidate.source}`)}
								</span>
								<span className="col-start-2 col-end-4 flex min-w-0 gap-x-1.5 text-muted-foreground text-sm">
									<span className="truncate">{candidate.positionTitle}</span>
									<span aria-hidden>·</span>
									<span className="shrink-0">
										{formatRelativeTime(candidate.appliedAt, now, locale)}
									</span>
								</span>
							</Link>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
