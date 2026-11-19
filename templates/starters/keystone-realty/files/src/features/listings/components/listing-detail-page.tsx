// The detail page of one listing: the title row with the actions,
// the tabs Overview, Viewings, and Enquiries, then on Overview a start column (profile, sale progress, features)
// and a wide column (history, then the offers and the interested leads side by side).
// The /app/listings/$listingId route renders it after its loader. An unknown id shows a not-found block.
import {
	ArrowLeftIcon,
	DownloadSimpleIcon,
	HouseLineIcon,
} from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
	addressOf,
	copyToClipboard,
	downloadCsv,
	InterestBadge,
	type LeadRow,
	LeadStatusBadge,
	moneyFormat,
	PersonAvatar,
	toCsv,
	type ViewingRow,
	ViewingStatusBadge,
} from "~/features/agency";
import { PageHeader } from "~/features/app-shell";
import { leadCsvColumns } from "~/features/leads";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import { RecordTable } from "~/shared/ui/record-table";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { listingQueryOptions } from "../api/listings.queries";
import { saleStepsDone } from "../lib/listing-timeline";
import { ListingActivityCard } from "./listing-activity-card";
import { ListingFeaturesCard } from "./listing-features-card";
import { ListingLeadsCard } from "./listing-leads-card";
import { ListingOffersCard } from "./listing-offers-card";
import { ListingProfileCard } from "./listing-profile-card";
import { ListingProgressCard } from "./listing-progress-card";

const DETAIL_TABS = ["overview", "viewings", "enquiries"] as const;

/** One tab of the page. The label is the message `listings.tabs.<tab>`. */
type DetailTab = (typeof DETAIL_TABS)[number];

// Rows per page of the two tab tables.
const PAGE_SIZE = 10;

type ListingDetailPageProps = {
	/** The `$listingId` param of the URL, for example "KS-4770". The query treats an unknown id as not found. */
	listingId: string;
};

/** The tab is state of the page. Each tab shows real rows of this home. */
export function ListingDetailPage({ listingId }: ListingDetailPageProps) {
	const { t, locale } = useT();
	const { data: detail } = useSuspenseQuery(listingQueryOptions(listingId));
	const [tab, setTab] = useState<DetailTab>("overview");
	const money = moneyFormat(locale);
	const dateTime = new Intl.DateTimeFormat(locale, {
		dateStyle: "medium",
		timeStyle: "short",
	});
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	const backLink = (
		<Button asChild variant="outline">
			<Link to="/app/listings">
				<ArrowLeftIcon className="rtl:rotate-180" />
				{t("listings.allListings")}
			</Link>
		</Button>
	);

	if (!detail) {
		return (
			<div className="grid gap-4">
				<PageHeader title={t("listings.notFoundTitle")} actions={backLink} />
				<Card>
					<CardContent className="grid justify-items-center gap-3 py-12 text-center">
						<HouseLineIcon className="size-8 text-muted-foreground" />
						<p className="max-w-sm text-muted-foreground text-sm">
							{t("listings.notFound")}
						</p>
					</CardContent>
				</Card>
			</div>
		);
	}
	const { listing, enquiries, viewings, timeline } = detail;
	const offers = enquiries
		.filter((lead) => lead.offerAt !== null)
		.sort((first, second) =>
			(second.offerAt ?? "").localeCompare(first.offerAt ?? ""),
		);

	return (
		<div className="grid gap-4">
			<PageHeader
				title={addressOf(listing)}
				description={`${t(`agency.propertyTypes.${listing.type}`)} · ${listing.neighborhood} · ${listing.id}`}
				actions={
					<>
						{backLink}
						<Button
							type="button"
							aria-label={t("listings.exportEnquiries")}
							onClick={() =>
								downloadCsv(
									`${listing.id}-enquiries.csv`,
									toCsv(enquiries, leadCsvColumns(t)),
								)
							}
						>
							<DownloadSimpleIcon />
							<span className="hidden lg:inline">
								{t("listings.exportEnquiries")}
							</span>
						</Button>
					</>
				}
			/>
			<Tabs
				value={tab}
				onValueChange={(value) => {
					const next = DETAIL_TABS.find((option) => option === value);
					if (next) {
						setTab(next);
					}
				}}
				className="gap-4"
			>
				<TabsList>
					{DETAIL_TABS.map((option) => (
						<TabsTrigger key={option} value={option}>
							{t(`listings.tabs.${option}`)}
						</TabsTrigger>
					))}
				</TabsList>
				<TabsContent value="overview">
					<div className="grid @4xl/main:grid-cols-3 items-start gap-4">
						<div className="grid min-w-0 gap-4">
							<ListingProfileCard listing={listing} />
							<ListingProgressCard stepsDone={saleStepsDone(timeline)} />
							<ListingFeaturesCard features={listing.features} />
						</div>
						<div className="@4xl/main:col-span-2 grid min-w-0 gap-4">
							<ListingActivityCard steps={timeline} />
							{/* Each card is as tall as its rows: a home often has fewer offers than leads. */}
							<div className="grid @4xl/main:grid-cols-2 items-start gap-4">
								<ListingOffersCard
									offers={offers}
									buyerId={detail.buyer?.id ?? null}
								/>
								<ListingLeadsCard
									leads={enquiries}
									onShowAll={() => setTab("enquiries")}
								/>
							</div>
						</div>
					</div>
				</TabsContent>
				<TabsContent value="viewings">
					<Card>
						<CardContent>
							<RecordTable<ViewingRow>
								rows={viewings}
								pageSize={PAGE_SIZE}
								noResults={t("listings.noViewings")}
								columns={[
									{
										id: "when",
										header: t("viewings.when"),
										sortValue: (row) => row.startsAt,
										cell: (row) => (
											<span className="tabular-nums">
												{dateTime.format(new Date(row.startsAt))}
											</span>
										),
									},
									{
										id: "lead",
										header: t("viewings.lead"),
										cell: (row) => (
											<span className="flex items-center gap-2" dir="auto">
												<PersonAvatar
													fullName={row.leadName}
													className="size-7"
												/>
												{row.leadName}
											</span>
										),
									},
									{
										id: "agent",
										header: t("viewings.agent"),
										cell: (row) => row.agentName,
									},
									{
										id: "status",
										header: t("viewings.status"),
										cell: (row) => <ViewingStatusBadge status={row.status} />,
									},
									{
										id: "interest",
										header: t("viewings.interest"),
										cell: (row) =>
											row.interest === null ? (
												<span className="text-muted-foreground">–</span>
											) : (
												<InterestBadge interest={row.interest} />
											),
									},
								]}
							/>
						</CardContent>
					</Card>
				</TabsContent>
				<TabsContent value="enquiries">
					<Card>
						<CardContent>
							<RecordTable<LeadRow>
								rows={enquiries}
								pageSize={PAGE_SIZE}
								noResults={t("listings.noEnquiries")}
								rowMenu={(row) => (
									<>
										<DropdownMenuItem asChild>
											<Link to="/app/leads" search={{ lead: row.id }}>
												{t("leads.openLead")}
											</Link>
										</DropdownMenuItem>
										<DropdownMenuItem
											onSelect={() =>
												copyToClipboard(row.email, {
													done: t("table.copied"),
													failed: t("table.copyFailed"),
												})
											}
										>
											{t("leads.copyEmail")}
										</DropdownMenuItem>
									</>
								)}
								columns={[
									{
										id: "lead",
										header: t("leads.lead"),
										sortValue: (row) => row.fullName,
										cell: (row) => (
											<div className="grid gap-0.5">
												<span className="font-medium" dir="auto">
													{row.fullName}
												</span>
												<span className="text-muted-foreground text-xs">
													{row.email}
												</span>
											</div>
										),
									},
									{
										id: "status",
										header: t("leads.status"),
										cell: (row) => <LeadStatusBadge status={row.status} />,
									},
									{
										id: "source",
										header: t("leads.source"),
										cell: (row) => t(`agency.leadSources.${row.source}`),
									},
									{
										id: "received",
										header: t("leads.received"),
										sortValue: (row) => row.createdAt,
										cell: (row) => (
											<span className="tabular-nums">
												{date.format(new Date(row.createdAt))}
											</span>
										),
									},
									{
										id: "offer",
										header: t("listings.offer"),
										align: "end",
										sortValue: (row) => row.offerAmount ?? 0,
										cell: (row) =>
											row.offerAmount === null
												? "–"
												: money.format(row.offerAmount),
									},
								]}
							/>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}

/** Placeholder while the detail loader runs. The route sets it as pendingComponent. */
export function ListingDetailPageSkeleton() {
	return (
		<div className="grid gap-4">
			<Skeleton className="h-9 w-72 max-w-full" />
			<Skeleton className="h-9 w-64" />
			<div className="grid @4xl/main:grid-cols-3 items-start gap-4">
				<Skeleton className="h-120" />
				<Skeleton className="@4xl/main:col-span-2 h-120" />
			</div>
		</div>
	);
}
