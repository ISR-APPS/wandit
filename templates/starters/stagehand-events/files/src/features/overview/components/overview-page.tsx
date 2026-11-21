// The box office home: the period and the export in the header, four KPI cards, the ticket type and ticket sales cards,
// the recent orders, weekday, and venue capacity cards, then the calendar beside the upcoming events table.
// The /app route renders it after its loader. The route also uses the skeleton and the error below.
// The page holds the period. The KPIs and the cards of the summary read the summary of that period.
import {
	CalendarStarIcon,
	CoinsIcon,
	DoorOpenIcon,
	DownloadSimpleIcon,
	TicketIcon,
} from "@phosphor-icons/react";
import {
	keepPreviousData,
	useQuery,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import { eventsQueryOptions } from "~/features/events";
import {
	addDays,
	type CsvColumn,
	downloadCsv,
	type EventSummary,
	fillMessage,
	moneyFormat,
	startOfLocalDay,
	toCsv,
	toIsoDay,
} from "~/features/organiser";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Skeleton } from "~/shared/ui/skeleton";
import { homeSummaryQueryOptions } from "../api/overview.queries";
import type { PeriodDays } from "../lib/series";
import { EventCalendarCard } from "./event-calendar-card";
import { KpiCard } from "./kpi-card";
import { dayCountFormat, PeriodSelect } from "./period-select";
import { RecentOrdersCard } from "./recent-orders-card";
import { TicketSalesCard } from "./ticket-sales-card";
import { TicketTypeCard } from "./ticket-type-card";
import { UpcomingEventsCard } from "./upcoming-events-card";
import { VenueCapacityCard } from "./venue-capacity-card";
import { WeekdaySalesCard } from "./weekday-sales-card";

/** The period of the home on the first load. The loader prefetches it. */
export const DEFAULT_DAYS: PeriodDays = 30;

/** Five bands, as the kit hotel and CRM dashboards. One column on a phone. */
export function OverviewPage() {
	const { t, locale } = useT();
	const [days, setDays] = useState<PeriodDays>(DEFAULT_DAYS);
	const { data: events } = useSuspenseQuery(eventsQueryOptions());
	// The loader fills the default period. Another period loads here and keeps the old numbers until it is ready.
	const summary = useQuery({
		...homeSummaryQueryOptions(days),
		placeholderData: keepPreviousData,
	});
	const now = Date.now();
	const money = moneyFormat(locale);
	const number = new Intl.NumberFormat(locale);
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 1,
	});
	const period = dayCountFormat(locale).format(days);
	const longDate = new Intl.DateTimeFormat(locale, {
		weekday: "long",
		day: "numeric",
		month: "long",
	});
	const ahead = events.filter(
		(event) => event.endsAt > now && event.status !== "cancelled",
	);
	const csvColumns: CsvColumn<EventSummary>[] = [
		{ header: t("events.event"), value: (row) => row.name },
		{ header: t("events.date"), value: (row) => toIsoDay(row.startsAt) },
		{ header: t("events.venue"), value: (row) => row.venue.name },
		{ header: t("events.sold"), value: (row) => String(row.sold) },
		{ header: t("events.capacity"), value: (row) => String(row.capacity) },
		{ header: t("events.gross"), value: (row) => String(row.gross) },
		{
			header: t("events.status"),
			value: (row) => t(`events.statuses.${row.status}`),
		},
	];

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("overview.title")}
				description={fillMessage(t("overview.periodDescription"), {
					period,
					// The sales period ends with yesterday, the last full day.
					day: longDate.format(addDays(startOfLocalDay(now), -1)),
				})}
				actions={
					<>
						<PeriodSelect days={days} onDaysChange={setDays} />
						<Button
							type="button"
							aria-label={t("common.exportCsv")}
							onClick={() =>
								downloadCsv("upcoming-events.csv", toCsv(ahead, csvColumns))
							}
						>
							<DownloadSimpleIcon />
							<span className="hidden lg:inline">{t("common.exportCsv")}</span>
						</Button>
					</>
				}
			/>
			{summary.isError ? (
				<div className="grid justify-items-start gap-3 rounded-surface border p-6">
					<p className="text-sm" role="alert">
						{t("overview.summaryError")}
					</p>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => summary.refetch()}
					>
						{t("common.retry")}
					</Button>
				</div>
			) : summary.data === undefined ? (
				<SummarySkeleton />
			) : (
				<>
					<div className="grid @4xl/main:grid-cols-4 @xl/main:grid-cols-2 gap-4">
						<KpiCard
							label={t("overview.kpis.upcomingEvents")}
							value={number.format(summary.data.upcomingEvents.value)}
							change={summary.data.upcomingEvents.change}
							context={fillMessage(t("overview.vsLast"), { period })}
							icon={CalendarStarIcon}
						/>
						<KpiCard
							label={t("overview.kpis.ticketsSold")}
							value={number.format(summary.data.tickets.value)}
							change={summary.data.tickets.change}
							context={fillMessage(t("overview.vsBefore"), { period })}
							icon={TicketIcon}
						/>
						<KpiCard
							label={t("overview.kpis.revenue")}
							value={money.format(summary.data.revenue.value)}
							change={summary.data.revenue.change}
							context={fillMessage(t("overview.vsBefore"), { period })}
							icon={CoinsIcon}
						/>
						<KpiCard
							label={t("overview.kpis.checkInRate")}
							value={
								summary.data.checkInRate.value === null
									? "–"
									: percent.format(summary.data.checkInRate.value)
							}
							change={summary.data.checkInRate.change}
							context={t("overview.endedEvents")}
							icon={DoorOpenIcon}
						/>
					</div>
					<div className="grid @4xl/main:grid-cols-3 gap-4">
						<TicketTypeCard
							tierMix={summary.data.tierMix}
							averageTicket={summary.data.averageTicket}
						/>
						<TicketSalesCard daily={summary.data.daily} days={days} />
					</div>
					{/* Two columns on a mid width: the venue card takes the full row under the other two. */}
					<div className="grid @2xl/main:grid-cols-2 @4xl/main:grid-cols-3 gap-4">
						<RecentOrdersCard />
						<WeekdaySalesCard weekdays={summary.data.weekdays} />
						<div className="@2xl/main:col-span-2 @4xl/main:col-span-1 grid">
							<VenueCapacityCard
								venueLoads={summary.data.venueLoads}
								days={days}
							/>
						</div>
					</div>
				</>
			)}
			<div className="grid @4xl/main:grid-cols-3 items-start gap-4">
				<EventCalendarCard events={events} now={now} />
				<UpcomingEventsCard events={events} now={now} />
			</div>
		</div>
	);
}

// Placeholder keys of the summary bands. Fixed keys, because the cards never reorder.
const SKELETON_KPIS = ["1", "2", "3", "4"];
const SKELETON_CARDS = ["1", "2", "3"];

// The KPI row and the two chart rows while the summary loads.
function SummarySkeleton() {
	return (
		<>
			<div className="grid @4xl/main:grid-cols-4 @xl/main:grid-cols-2 gap-4">
				{SKELETON_KPIS.map((key) => (
					<Skeleton key={key} className="h-36" />
				))}
			</div>
			<div className="grid @4xl/main:grid-cols-3 gap-4">
				<Skeleton className="h-96" />
				<Skeleton className="@4xl/main:col-span-2 h-96" />
			</div>
			<div className="grid @2xl/main:grid-cols-2 @4xl/main:grid-cols-3 gap-4">
				{SKELETON_CARDS.map((key) => (
					<Skeleton key={key} className="h-96" />
				))}
			</div>
		</>
	);
}

/** Placeholder while the loader runs. The route sets it as pendingComponent. */
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
			<SummarySkeleton />
			<div className="grid @4xl/main:grid-cols-3 gap-4">
				<Skeleton className="h-112" />
				<Skeleton className="@4xl/main:col-span-2 h-112" />
			</div>
		</div>
	);
}

/** Error state when the loader fails. Try again runs the loader again. */
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
