// The home behind login: the period and the export in the header, four stat cards, the 7-day report and
// the content readiness donut, then two rows of three cards. It follows the kit "website analytics" page.
// The /app route renders it after its loader. The route also uses the skeleton and the error below.
// The page holds the period. The stat cards and five of the cards read the data of that period.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import {
	keepPreviousData,
	useQuery,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import { campaignsQueryOptions } from "~/features/campaigns";
import {
	dayCountFormat,
	downloadCsv,
	fillMessage,
	type PeriodDays,
	PeriodSelect,
	toCsv,
} from "~/features/marketing";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card } from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	OVERVIEW_DEFAULT_DAYS,
	overviewQueryOptions,
} from "../api/overview.queries";
import { ContentReadinessCard } from "./content-readiness-card";
import { ConversionsReportCard } from "./conversions-report-card";
import { DailyConversionsCard } from "./daily-conversions-card";
import { MonthlySpendCard } from "./monthly-spend-card";
import { PeriodResultsCard } from "./period-results-card";
import { PortfolioCard } from "./portfolio-card";
import { RevenueSplitCard } from "./revenue-split-card";
import { StatCard } from "./stat-card";
import { TopCampaignsCard } from "./top-campaigns-card";

// One column on a phone, two from 42rem, twelve from 56rem. The kit uses 12 columns on wide screens.
// grid-cols-1 and min-w-0 stop a wide child (a chart, a table) from pushing the page past the phone width.
const GRID =
	"grid grid-cols-1 gap-4 @2xl/main:grid-cols-2 @4xl/main:grid-cols-12";
const SPANS = {
	stats:
		"grid min-w-0 grid-cols-1 gap-4 @2xl/main:col-span-2 @4xl/main:col-span-12 @xl/main:grid-cols-2 @4xl/main:grid-cols-4",
	report: "min-w-0 @2xl/main:col-span-2 @4xl/main:col-span-8",
	readiness: "min-w-0 @2xl/main:col-span-2 @4xl/main:col-span-4",
	third: "min-w-0 @4xl/main:col-span-4",
} as const;

/** Four bands, as in the kit: stats, 8/12 + 4/12, then two rows of 4/12 cards. */
export function OverviewPage() {
	const { t, locale } = useT();
	const [days, setDays] = useState<PeriodDays>(OVERVIEW_DEFAULT_DAYS);
	const { data: campaigns } = useSuspenseQuery(campaignsQueryOptions());
	// The loader fills the default period. Another period loads here and keeps the old numbers until it is ready.
	const period = useQuery({
		...overviewQueryOptions(days),
		placeholderData: keepPreviousData,
	});
	const now = Date.now();
	const dayCount = dayCountFormat(locale);
	const today = new Intl.DateTimeFormat(locale, {
		weekday: "long",
		day: "numeric",
		month: "long",
	});
	const periodLabel = fillMessage(t("period.last"), {
		period: dayCount.format(days),
	});
	const liveCount = campaigns.filter(
		(campaign) => campaign.status === "live",
	).length;

	function exportDaily() {
		if (!period.data) {
			return;
		}
		downloadCsv(
			`results-last-${days}-days.csv`,
			toCsv(
				period.data.daily.map((row) => ({ id: row.day, ...row })),
				[
					{ header: t("overview.csvDay"), value: (row) => row.day },
					{ header: t("metrics.spend"), value: (row) => row.spend.toFixed(2) },
					{
						header: t("metrics.impressions"),
						value: (row) => String(row.impressions),
					},
					{ header: t("metrics.clicks"), value: (row) => String(row.clicks) },
					{
						header: t("metrics.conversions"),
						value: (row) => String(row.conversions),
					},
					{
						header: t("metrics.revenue"),
						value: (row) => row.revenue.toFixed(2),
					},
				],
			),
		);
	}

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("overview.title")}
				description={fillMessage(t("period.description"), {
					period: dayCount.format(days),
					today: today.format(now),
				})}
				actions={
					<>
						<PeriodSelect days={days} onDaysChange={setDays} />
						<Button
							type="button"
							aria-label={t("common.exportCsv")}
							disabled={!period.data}
							onClick={exportDaily}
						>
							<DownloadSimpleIcon />
							<span className="hidden lg:inline">{t("common.exportCsv")}</span>
						</Button>
					</>
				}
			/>
			<div className={GRID}>
				<div className={SPANS.stats}>
					{period.data
						? period.data.kpis.map((figure) => (
								<StatCard key={figure.id} figure={figure} />
							))
						: [0, 1, 2, 3].map((slot) => (
								<Skeleton key={slot} className="h-28 rounded-surface" />
							))}
				</div>
				<div className={SPANS.report}>
					<ConversionsReportCard />
				</div>
				<div className={SPANS.readiness}>
					<ContentReadinessCard />
				</div>
				<div className={SPANS.third}>
					<PortfolioCard />
				</div>
				{period.isError ? (
					<PeriodError onRetry={() => period.refetch()} />
				) : period.data ? (
					<>
						<div className={SPANS.third}>
							<DailyConversionsCard overview={period.data} />
						</div>
						<div className={SPANS.third}>
							<RevenueSplitCard overview={period.data} />
						</div>
						<div className={SPANS.third}>
							<TopCampaignsCard
								overview={period.data}
								periodLabel={periodLabel}
							/>
						</div>
						<div className={SPANS.third}>
							<MonthlySpendCard />
						</div>
						<div className={SPANS.third}>
							<PeriodResultsCard overview={period.data} liveCount={liveCount} />
						</div>
					</>
				) : (
					[0, 1, 2, 3, 4].map((slot) => (
						<Skeleton
							key={slot}
							className={`h-72 rounded-surface ${SPANS.third}`}
						/>
					))
				)}
			</div>
		</div>
	);
}

type PeriodErrorProps = {
	/** Runs the period query again. */
	onRetry: () => void;
};

// The period data failed, but the cards outside the period still show. The error takes the place of the five cards.
function PeriodError({ onRetry }: PeriodErrorProps) {
	const { t } = useT();
	return (
		<div className="@2xl/main:col-span-2 @4xl/main:col-span-8 grid min-w-0 justify-items-start gap-3 rounded-surface border p-6">
			<p className="text-sm" role="alert">
				{t("overview.periodError")}
			</p>
			<Button type="button" variant="outline" size="sm" onClick={onRetry}>
				{t("common.retry")}
			</Button>
		</div>
	);
}

/** Placeholder while the home loader runs: the same bands with the same spans. */
export function OverviewPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex items-end justify-between gap-4">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-40" />
					<Skeleton className="h-4 w-72" />
				</div>
				<Skeleton className="h-9 w-48" />
			</div>
			<div className={GRID}>
				<div className={SPANS.stats}>
					{[0, 1, 2, 3].map((slot) => (
						<Card key={slot} className="h-28" />
					))}
				</div>
				<Card className={`h-96 ${SPANS.report}`} />
				<Card className={`h-96 ${SPANS.readiness}`} />
				{[0, 1, 2, 3, 4, 5].map((slot) => (
					<Card key={slot} className={`h-72 ${SPANS.third}`} />
				))}
			</div>
		</div>
	);
}

/** Error state of the home when the loader fails. Try again runs the loader again. */
export function OverviewPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("overview.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
