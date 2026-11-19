// The home behind login, in the band order of the kit analytics page: four KPI cards, the event volume card
// beside the activation card (8 + 4 of 12 columns), then two rows of three small cards.
// The /app route renders it after its loader. The route also uses the skeleton and the error below.
// The page holds the period. Every card reads the overview of that period from one query.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	changeRatio,
	DEFAULT_DAYS,
	dayCountFormat,
	dayToDate,
	downloadCsv,
	fillMessage,
	type PeriodDays,
	PeriodSelect,
	toCsv,
} from "~/features/tracking";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Skeleton } from "~/shared/ui/skeleton";
import { type Overview, overviewQueryOptions } from "../api/overview.queries";
import { ActivationCard } from "./activation-card";
import { DailyEventsCard } from "./daily-events-card";
import { DevicesCard } from "./devices-card";
import { EventVolumeCard } from "./event-volume-card";
import { ProductAreasCard } from "./product-areas-card";
import { SignUpSourcesCard } from "./sign-up-sources-card";
import { SignUpWeeksCard } from "./sign-up-weeks-card";
import { StatCard } from "./stat-card";
import { TopAccountsCard } from "./top-accounts-card";

// 12 columns from the 2xl container width, as the kit page. One minmax(0, 1fr) column on a phone.
const PAGE_GRID = "grid grid-cols-1 gap-4 @2xl/main:grid-cols-12";
const KPI_ROW =
	"grid gap-4 @md/main:grid-cols-2 @3xl/main:grid-cols-4 @2xl/main:col-span-12";
const WIDE_CARD = "@2xl/main:col-span-12 @4xl/main:col-span-8";
const SIDE_CARD = "@2xl/main:col-span-12 @4xl/main:col-span-4";
// Three small cards from 4xl (896 px), as the kit. Two below it: a third card of 230 px clips its rows.
const SMALL_CARD = "@2xl/main:col-span-6 @4xl/main:col-span-4";

/** The period select changes every card. The old numbers stay on screen until the new period is ready. */
export function OverviewPage() {
	const { t, locale } = useT();
	const [days, setDays] = useState<PeriodDays>(DEFAULT_DAYS);
	// The loader fills the default period. Another period loads here and keeps the old numbers until it is ready.
	const overview = useQuery({
		...overviewQueryOptions(days),
		placeholderData: keepPreviousData,
	});
	const period = dayCountFormat(locale).format(days);
	const longDay = new Intl.DateTimeFormat(locale, {
		weekday: "long",
		day: "numeric",
		month: "long",
		timeZone: "UTC",
	});
	const lastDay = overview.data?.dailyEvents.at(-1)?.day;

	function exportDays(data: Overview) {
		downloadCsv(
			`events-last-${days}-days.csv`,
			toCsv(
				data.dailyEvents.map((point) => ({ id: point.day, ...point })),
				[
					{ header: t("overview.csv.day"), value: (row) => row.day },
					{
						header: t("overview.volume.events"),
						value: (row) => String(row.current),
					},
				],
			),
		);
	}

	return (
		// grid-cols-1 is minmax(0, 1fr): the page column keeps the width of the main area, not of its widest card.
		<div className="grid grid-cols-1 gap-4">
			<PageHeader
				title={t("overview.title")}
				description={
					lastDay
						? fillMessage(t("overview.description"), {
								period,
								day: longDay.format(dayToDate(lastDay)),
							})
						: undefined
				}
				actions={
					<>
						<PeriodSelect days={days} onDaysChange={setDays} />
						<Button
							type="button"
							aria-label={t("overview.download")}
							disabled={overview.data === undefined}
							onClick={() => {
								if (overview.data) {
									exportDays(overview.data);
								}
							}}
						>
							<DownloadSimpleIcon />
							<span className="hidden lg:inline">{t("overview.download")}</span>
						</Button>
					</>
				}
			/>
			{overview.isError ? (
				<div className="grid justify-items-start gap-3 rounded-surface border p-6">
					<p className="text-sm" role="alert">
						{t("overview.loadError")}
					</p>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => overview.refetch()}
					>
						{t("common.retry")}
					</Button>
				</div>
			) : overview.data === undefined ? (
				<OverviewGridSkeleton />
			) : (
				<OverviewGrid data={overview.data} period={period} />
			)}
		</div>
	);
}

type OverviewGridProps = {
	data: Overview;
	/** The period in words, for example "30 days". */
	period: string;
};

// The cards of one loaded period, in the kit order.
function OverviewGrid({ data, period }: OverviewGridProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 1,
	});
	const lastPeriod = fillMessage(t("overview.lastPeriod"), { period });
	const activation = data.activationRate;

	return (
		<div className={PAGE_GRID}>
			<div className={KPI_ROW}>
				<StatCard
					label={t("overview.kpis.activeAccounts")}
					value={number.format(data.activeAccounts.current)}
					change={changeRatio(
						data.activeAccounts.current,
						data.activeAccounts.previous,
					)}
				/>
				<StatCard
					label={t("overview.kpis.dailyActiveUsers")}
					value={number.format(data.dailyActiveUsers.current)}
					change={changeRatio(
						data.dailyActiveUsers.current,
						data.dailyActiveUsers.previous,
					)}
				/>
				<StatCard
					label={t("overview.kpis.events")}
					value={number.format(data.events.current)}
					change={changeRatio(data.events.current, data.events.previous)}
				/>
				<StatCard
					label={t("overview.kpis.activationRate")}
					value={
						activation.current === null
							? "–"
							: percent.format(activation.current)
					}
					change={
						activation.current === null || activation.previous === null
							? null
							: changeRatio(activation.current, activation.previous)
					}
				/>
			</div>
			<div className={WIDE_CARD}>
				<EventVolumeCard
					description={fillMessage(t("overview.volume.description"), {
						period,
					})}
					events={data.events}
					weekdayEvents={data.weekdayEvents}
					areas={data.areas}
				/>
			</div>
			<div className={SIDE_CARD}>
				<ActivationCard funnel={data.funnel} />
			</div>
			<div className={SMALL_CARD}>
				<SignUpSourcesCard channels={data.channels} />
			</div>
			<div className={SMALL_CARD}>
				<DailyEventsCard points={data.dailyEvents} />
			</div>
			<div className={SMALL_CARD}>
				<DevicesCard activeUsers={data.activeUsers} devices={data.devices} />
			</div>
			<div className={SMALL_CARD}>
				<TopAccountsCard description={lastPeriod} accounts={data.topAccounts} />
			</div>
			<div className={SMALL_CARD}>
				<SignUpWeeksCard weeks={data.signUpWeeks} totals={data.signUpTotals} />
			</div>
			<div className={SMALL_CARD}>
				<ProductAreasCard areas={data.areas} />
			</div>
		</div>
	);
}

// Placeholder keys. Fixed keys, because the cards never reorder.
const SKELETON_KPIS = ["1", "2", "3", "4"];
const SKELETON_SMALL = ["1", "2", "3", "4", "5", "6"];

// The grid of cards while the overview loads, in the same spans.
function OverviewGridSkeleton() {
	return (
		<div className={PAGE_GRID}>
			<div className={KPI_ROW}>
				{SKELETON_KPIS.map((key) => (
					<Skeleton key={key} className="h-24" />
				))}
			</div>
			<Skeleton className={`h-104 ${WIDE_CARD}`} />
			<Skeleton className={`h-104 ${SIDE_CARD}`} />
			{SKELETON_SMALL.map((key) => (
				<Skeleton key={key} className={`h-56 ${SMALL_CARD}`} />
			))}
		</div>
	);
}

/** Placeholder while the home loader runs. The route sets it as pendingComponent. */
export function OverviewPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-40" />
					<Skeleton className="h-4 w-72 max-w-full" />
				</div>
				<Skeleton className="h-9 w-64 max-w-full" />
			</div>
			<OverviewGridSkeleton />
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
