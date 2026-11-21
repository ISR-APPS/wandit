// The home behind login, in four bands:
// four ruled KPI cards; the performance chart, the featured listing, the sales progress, and the reminders;
// the new leads, the leads by source, and the listing overview; then the active listings and the calendar.
// The /app route renders it after its loader. The route also uses the skeleton and the error below.
import {
	CheckCircleIcon,
	CurrencyCircleDollarIcon,
	HouseLineIcon,
	UsersThreeIcon,
} from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import {
	compactMoneyFormat,
	fillMessage,
	type LeadRow,
} from "~/features/agency";
import { leadsQueryOptions } from "~/features/leads";
import { listingsQueryOptions } from "~/features/listings";
import {
	ViewingsCalendarCard,
	viewingsQueryOptions,
} from "~/features/viewings";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Skeleton } from "~/shared/ui/skeleton";
import { homeSummaryQueryOptions } from "../api/overview.queries";
import { COMPARE_DAYS } from "../lib/series";
import { ActiveListingsCard } from "./active-listings-card";
import { FeaturedListingCard } from "./featured-listing-card";
import { KpiCard } from "./kpi-card";
import { ListingMixCard } from "./listing-mix-card";
import { NewLeadsCard } from "./new-leads-card";
import { PerformanceCard } from "./performance-card";
import { RemindersCard } from "./reminders-card";
import { SalesProgressCard } from "./sales-progress-card";
import { SourceCard } from "./source-card";

// The new leads card lists 4 people and the reminders card 3 viewings, so each card fits its band.
const NEW_LEADS_SHOWN = 4;
const REMINDERS_SHOWN = 3;

/** The page has no visible title row, so the h1 is for screen readers only. */
export function OverviewPage() {
	const { t, locale } = useT();
	const { data: summary } = useSuspenseQuery(homeSummaryQueryOptions());
	const { data: leads } = useSuspenseQuery(leadsQueryOptions());
	const { data: listings } = useSuspenseQuery(listingsQueryOptions());
	const { data: viewings } = useSuspenseQuery(viewingsQueryOptions());
	const now = Date.now();
	const number = new Intl.NumberFormat(locale);
	const money = compactMoneyFormat(locale);
	const sinceDays = fillMessage(t("overview.kpis.vsDaysAgo"), {
		days: number.format(COMPARE_DAYS),
	});

	// LIMIT: the lists below read the newest 1,000 rows of each query. Upgrade: one query per list with its filter and order.
	const onMarket = listings
		.filter(
			(listing) =>
				listing.status === "active" || listing.status === "under_offer",
		)
		.sort(
			(first, second) =>
				second.enquiryCount - first.enquiryCount ||
				second.viewingCount - first.viewingCount,
		);
	// The featured home is the home with no accepted offer that the most leads asked about.
	const featured =
		onMarket.find((listing) => listing.status === "active") ?? null;
	const openLeads = new Map<string, LeadRow[]>();
	for (const lead of leads) {
		const isOpen = lead.status !== "won" && lead.status !== "lost";
		if (isOpen && lead.listingId !== null) {
			openLeads.set(lead.listingId, [
				...(openLeads.get(lead.listingId) ?? []),
				lead,
			]);
		}
	}
	const nextViewings = viewings
		.filter(
			(viewing) =>
				(viewing.status === "requested" || viewing.status === "confirmed") &&
				Date.parse(viewing.startsAt) > now,
		)
		.slice(0, REMINDERS_SHOWN);

	return (
		<div className="grid gap-4">
			<h1 className="sr-only">{t("overview.title")}</h1>
			<div className="grid @4xl/main:grid-cols-4 @xl/main:grid-cols-2 gap-4">
				<KpiCard
					label={t("overview.kpis.activeLeads")}
					value={number.format(summary.kpis.activeLeads.value)}
					change={summary.kpis.activeLeads.change}
					comparison={sinceDays}
					icon={UsersThreeIcon}
				/>
				<KpiCard
					label={t("overview.kpis.pipelineValue")}
					value={money.format(summary.kpis.pipelineValue.value)}
					change={summary.kpis.pipelineValue.change}
					comparison={sinceDays}
					icon={CurrencyCircleDollarIcon}
				/>
				<KpiCard
					label={t("overview.kpis.activeListings")}
					value={number.format(summary.kpis.activeListings.value)}
					change={summary.kpis.activeListings.change}
					comparison={sinceDays}
					icon={HouseLineIcon}
				/>
				<KpiCard
					label={t("overview.kpis.closedThisQuarter")}
					value={number.format(summary.kpis.closedThisQuarter.value)}
					change={summary.kpis.closedThisQuarter.change}
					comparison={t("overview.kpis.vsLastQuarter")}
					icon={CheckCircleIcon}
				/>
			</div>
			{/* These three share one row only on a very wide screen. Under it, they stack. */}
			<div className="grid @7xl/main:grid-cols-3 gap-4">
				<PerformanceCard series={summary.performance} />
				<div className="grid content-start gap-4">
					<FeaturedListingCard listing={featured} />
					<SalesProgressCard progress={summary.salesProgress} />
				</div>
				<RemindersCard viewings={nextViewings} />
			</div>
			<div className="grid @2xl/main:grid-cols-2 @4xl/main:grid-cols-4 gap-4">
				<NewLeadsCard leads={leads.slice(0, NEW_LEADS_SHOWN)} />
				<SourceCard
					months={summary.sourceMonths}
					className="@2xl/main:col-span-2 @2xl/main:row-start-2 @4xl/main:row-start-auto"
				/>
				<ListingMixCard mix={summary.listingMix} />
			</div>
			<div className="grid @4xl/main:grid-cols-2 gap-4">
				<ActiveListingsCard listings={onMarket} openLeads={openLeads} />
				<ViewingsCalendarCard />
			</div>
		</div>
	);
}

// Placeholder keys of the bands. Fixed keys, because the cards never reorder.
const SKELETON_KPIS = ["1", "2", "3", "4"];

/** Placeholder while the loader runs. The route sets it as pendingComponent. */
export function OverviewPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="grid @4xl/main:grid-cols-4 @xl/main:grid-cols-2 gap-4">
				{SKELETON_KPIS.map((key) => (
					<Skeleton key={key} className="h-36" />
				))}
			</div>
			<Skeleton className="h-96" />
			<Skeleton className="h-64" />
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
