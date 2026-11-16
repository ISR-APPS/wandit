// The listings page behind login: the page header with the agent filter, the summary strip, and the table.
// The /app/listings route renders it after its loader. The route also uses the skeleton and the error below.
// The agent filter applies to the strip and to the table. The status tabs filter the table only.
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import {
	AGENTS,
	addressOf,
	LISTING_STATUSES,
	type ListingRow,
	type ListingStatus,
	ListingStatusBadge,
	moneyFormat,
	PersonAvatar,
	PropertyTile,
} from "~/features/agency";
import { PageHeader } from "~/features/app-shell";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";
import { DataTable, type DataTableColumn } from "~/shared/ui/data-table";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { listingsQueryOptions } from "../api/listings.queries";
import { ListingsSummary } from "./listings-summary";

// The value of the agent filter that shows the listings of every agent.
const ALL_AGENTS = "all";

// On a phone the status tabs scroll sideways. The end fades, so the user sees that more tabs follow.
// pe-12 lets the last tab leave the faded end when the strip is at the end of its scroll.
const SCROLL_TABS =
	"max-w-full overflow-x-auto max-sm:pe-12 max-sm:[mask-image:linear-gradient(to_right,var(--foreground)_80%,transparent)] max-sm:rtl:[mask-image:linear-gradient(to_left,var(--foreground)_80%,transparent)]";

// The columns hide by the width of the page panel, also when the sidebar closes.
// The numbers are the places of the columns in `columns` below. Keep them in that order.
// Under 36rem (a phone): the home and the price stay. Under 56rem: the enquiries, the size, and the agent hide.
const COLUMN_WIDTHS =
	"@max-xl/main:[&_:is(th,td):is(:nth-child(2),:nth-child(4))]:hidden @max-4xl/main:[&_:is(th,td):nth-child(n+5)]:hidden";

/** The list page. The agent filter and the status tab filter the rows; then DataTable searches, sorts, and pages them. */
export function ListingsPage() {
	const { t, locale } = useT();
	const { data: listings } = useSuspenseQuery(listingsQueryOptions());
	const [agentId, setAgentId] = useState(ALL_AGENTS);
	const [status, setStatus] = useState<ListingStatus | "all">("all");

	const number = new Intl.NumberFormat(locale);
	const money = moneyFormat(locale);
	const ofAgent =
		agentId === ALL_AGENTS
			? listings
			: listings.filter((listing) => listing.agentId === agentId);
	// A tab shows only for a status that has rows.
	const tabs = LISTING_STATUSES.map((value) => ({
		value,
		count: ofAgent.filter((row) => row.status === value).length,
	})).filter((tab) => tab.count > 0);
	// The agent filter can empty the chosen tab. Its tab then disappears, so the list shows all rows.
	const activeStatus = tabs.some((tab) => tab.value === status)
		? status
		: "all";
	const rows =
		activeStatus === "all"
			? ofAgent
			: ofAgent.filter((row) => row.status === activeStatus);

	const columns: DataTableColumn<ListingRow>[] = [
		{
			id: "home",
			header: t("listings.home"),
			sortValue: (row) => row.street,
			cell: (row) => (
				<div className="flex items-center gap-3">
					<PropertyTile type={row.type} />
					<div className="grid justify-items-start gap-0.5 whitespace-normal">
						<Link
							to="/app/listings/$listingId"
							params={{ listingId: row.id }}
							className="font-medium hover:underline"
						>
							{addressOf(row)}
						</Link>
						<span className="text-muted-foreground text-xs">
							{`${row.neighborhood} · ${t(`agency.propertyTypes.${row.type}`)}`}
						</span>
						{/* On a phone the status column hides, so the status sits under the address. */}
						<div className="@xl/main:hidden">
							<ListingStatusBadge status={row.status} />
						</div>
					</div>
				</div>
			),
		},
		{
			id: "status",
			header: t("listings.status"),
			sortValue: (row) => LISTING_STATUSES.indexOf(row.status),
			cell: (row) => <ListingStatusBadge status={row.status} />,
		},
		{
			id: "price",
			header: t("listings.price"),
			align: "end",
			sortValue: (row) => row.askingPrice,
			cell: (row) => (
				<div className="grid justify-items-end">
					<span>{money.format(row.askingPrice)}</span>
					{row.priceReducedAt === null ? null : (
						<span className="text-muted-foreground text-xs">
							{t("listings.reduced")}
						</span>
					)}
				</div>
			),
		},
		{
			id: "days",
			header: t("listings.daysOnMarket"),
			align: "end",
			sortValue: (row) => row.daysOnMarket,
			// A home that is not yet on the market has no days to count.
			cell: (row) =>
				row.status === "coming_soon" ? "–" : number.format(row.daysOnMarket),
		},
		{
			id: "enquiries",
			header: t("listings.enquiries"),
			align: "end",
			sortValue: (row) => row.enquiryCount,
			cell: (row) => number.format(row.enquiryCount),
		},
		{
			id: "size",
			header: t("listings.size"),
			align: "end",
			sortValue: (row) => row.areaSqft,
			cell: (row) => (
				<div className="grid justify-items-end">
					<span>{`${number.format(row.areaSqft)} ${t("agency.sqft")}`}</span>
					<span className="text-muted-foreground text-xs">
						{row.bedrooms === 0
							? t("agency.propertyTypes.studio")
							: `${number.format(row.bedrooms)} ${t("agency.bedShort")} · ${number.format(row.bathrooms)} ${t("agency.bathShort")}`}
					</span>
				</div>
			),
		},
		{
			id: "agent",
			header: t("listings.agent"),
			sortValue: (row) => row.agentName,
			cell: (row) => (
				<div className="flex items-center gap-2">
					<PersonAvatar fullName={row.agentName} className="size-7" />
					<span>{row.agentName}</span>
				</div>
			),
		},
	];

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("listings.title")}
				description={t("listings.description")}
				actions={
					<Select value={agentId} onValueChange={setAgentId}>
						<SelectTrigger className="w-48" aria-label={t("listings.agent")}>
							<SelectValue />
						</SelectTrigger>
						<SelectContent align="end">
							<SelectItem value={ALL_AGENTS}>
								{t("listings.allAgents")}
							</SelectItem>
							{AGENTS.map((agent) => (
								<SelectItem key={agent.id} value={agent.id}>
									{agent.fullName}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				}
			/>
			<ListingsSummary listings={ofAgent} />
			{ofAgent.length === 0 ? (
				<Card>
					<CardContent className="grid justify-items-center gap-3 py-10 text-center">
						<p className="text-muted-foreground text-sm">
							{t("listings.emptyAgent")}
						</p>
						<Button
							type="button"
							variant="outline"
							onClick={() => setAgentId(ALL_AGENTS)}
						>
							{t("listings.allAgents")}
						</Button>
					</CardContent>
				</Card>
			) : (
				<Card>
					<CardContent className={COLUMN_WIDTHS}>
						<DataTable
							rows={rows}
							columns={columns}
							searchText={(row) =>
								`${row.id} ${addressOf(row)} ${row.neighborhood} ${row.sellerName} ${row.agentName}`
							}
							noResults={t("listings.noResults")}
							toolbar={
								<Tabs
									value={activeStatus}
									onValueChange={(value) =>
										setStatus(
											LISTING_STATUSES.find((option) => option === value) ??
												"all",
										)
									}
									className={SCROLL_TABS}
								>
									<TabsList>
										<TabsTrigger value="all">
											{t("listings.all")}
											<span className="text-muted-foreground tabular-nums">
												{number.format(ofAgent.length)}
											</span>
										</TabsTrigger>
										{tabs.map((tab) => (
											<TabsTrigger key={tab.value} value={tab.value}>
												{t(`agency.listingStatuses.${tab.value}`)}
												<span className="text-muted-foreground tabular-nums">
													{number.format(tab.count)}
												</span>
											</TabsTrigger>
										))}
									</TabsList>
								</Tabs>
							}
						/>
					</CardContent>
				</Card>
			)}
		</div>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8"];

/** Placeholder while the list loader runs. The route sets it as pendingComponent. */
export function ListingsPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-40" />
					<Skeleton className="h-4 w-72 max-w-full" />
				</div>
				<Skeleton className="h-9 w-48" />
			</div>
			<Skeleton className="h-28 w-full" />
			<Card>
				<CardContent className="grid gap-3">
					<Skeleton className="h-9 w-full sm:max-w-xs" />
					{SKELETON_ROWS.map((key) => (
						<Skeleton key={key} className="h-12 w-full" />
					))}
				</CardContent>
			</Card>
		</div>
	);
}

/** Error state of the list and of the detail page when the loader fails. Try again runs the loader again. */
export function ListingsPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("listings.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
