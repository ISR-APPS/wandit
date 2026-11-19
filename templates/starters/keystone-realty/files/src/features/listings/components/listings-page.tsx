// The listings page: the title and the export, four figure cards,
// then the table of every home with a filter field, status, type, and price filters, a column menu,
// row checkboxes, a row menu, and pages. The /app/listings route renders it after its loader.
// The filters are state of this page. RecordTable holds the search, the sort, the selection, and the page.
import { DownloadSimpleIcon, EyeIcon } from "@phosphor-icons/react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import {
	compactMoneyFormat,
	copyToClipboard,
	downloadCsv,
	LISTING_STATUSES,
	type ListingRow,
	type ListingStatus,
	ListingStatusBadge,
	moneyFormat,
	PROPERTY_TYPES,
	PropertyTile,
	toCsv,
} from "~/features/agency";
import { PageHeader } from "~/features/app-shell";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import { RecordFilter, RecordTable } from "~/shared/ui/record-table";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	listingFiguresQueryOptions,
	listingsQueryOptions,
} from "../api/listings.queries";
import { listingCsvColumns } from "../lib/listing-csv";
import { ListingKpiCard } from "./listing-kpi-card";

const PRICE_BAND_IDS = ["all", "under500k", "from500kTo1m", "over1m"] as const;

/** One choice of the price filter. The label is the message `listings.priceBands.<band>`. */
type PriceBand = (typeof PRICE_BAND_IDS)[number];

// The bounds of each price band, in whole currency units. A band includes its lower bound.
const PRICE_BANDS = {
	all: { min: 0, max: Number.POSITIVE_INFINITY },
	under500k: { min: 0, max: 500_000 },
	from500kTo1m: { min: 500_000, max: 1_000_000 },
	over1m: { min: 1_000_000, max: Number.POSITIVE_INFINITY },
} satisfies Record<PriceBand, { min: number; max: number }>;

// Placeholder keys of the figure row. Fixed keys, because the cards never reorder.
const SKELETON_FIGURES = ["1", "2", "3", "4"];

// Rows per page. Ten rows keep one page short enough to scan.
const PAGE_SIZE = 10;

/** Every home of the agency, newest first. The figures load after the table, so the table never waits for them. */
export function ListingsPage() {
	const { t, locale } = useT();
	const { data: listings } = useSuspenseQuery(listingsQueryOptions());
	const figures = useQuery(listingFiguresQueryOptions());
	const [status, setStatus] = useState<ListingStatus | null>(null);
	const [type, setType] = useState<string | null>(null);
	const [priceBand, setPriceBand] = useState<PriceBand>("all");
	const money = moneyFormat(locale);
	const compactMoney = compactMoneyFormat(locale);
	const number = new Intl.NumberFormat(locale);
	const band = PRICE_BANDS[priceBand];
	const rows = listings.filter(
		(listing) =>
			(status === null || listing.status === status) &&
			(type === null || listing.type === type) &&
			listing.askingPrice >= band.min &&
			listing.askingPrice < band.max,
	);

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("listings.title")}
				actions={
					<Button
						type="button"
						aria-label={t("common.exportCsv")}
						onClick={() =>
							downloadCsv("listings.csv", toCsv(rows, listingCsvColumns(t)))
						}
					>
						<DownloadSimpleIcon />
						<span className="hidden lg:inline">{t("common.exportCsv")}</span>
					</Button>
				}
			/>
			<div className="grid @4xl/main:grid-cols-4 @xl/main:grid-cols-2 gap-4">
				{figures.isError ? (
					<p
						className="@4xl/main:col-span-4 @xl/main:col-span-2 text-muted-foreground text-sm"
						role="alert"
					>
						{t("listings.figuresError")}
					</p>
				) : figures.data === undefined ? (
					SKELETON_FIGURES.map((key) => <Skeleton key={key} className="h-28" />)
				) : (
					<>
						<ListingKpiCard
							label={t("listings.figures.underOffer")}
							value={figures.data.underOffer.value}
							format={number}
							change={figures.data.underOffer.change}
							goodWhen="up"
						/>
						<ListingKpiCard
							label={t("listings.figures.medianAskingPrice")}
							value={figures.data.medianAskingPrice.value}
							format={compactMoney}
							change={figures.data.medianAskingPrice.change}
							goodWhen="up"
						/>
						<ListingKpiCard
							label={t("listings.figures.medianDaysOnMarket")}
							value={figures.data.medianDaysOnMarket.value}
							format={number}
							change={figures.data.medianDaysOnMarket.change}
							goodWhen="down"
						/>
						<ListingKpiCard
							label={t("listings.figures.soldRecently")}
							value={figures.data.soldRecently.value}
							format={number}
							change={figures.data.soldRecently.change}
							goodWhen="up"
						/>
					</>
				)}
			</div>
			<div className="pt-4">
				<RecordTable<ListingRow>
					rows={rows}
					pageSize={PAGE_SIZE}
					selectable
					searchText={(row) => `${row.street} ${row.neighborhood} ${row.id}`}
					searchPlaceholder={t("listings.searchPlaceholder")}
					noResults={t("listings.noResults")}
					toolbar={
						<>
							<RecordFilter
								label={t("listings.status")}
								options={LISTING_STATUSES.map((value) => ({
									value,
									label: t(`agency.listingStatuses.${value}`),
								}))}
								value={status}
								onValueChange={(value) =>
									setStatus(
										LISTING_STATUSES.find((option) => option === value) ?? null,
									)
								}
							/>
							<RecordFilter
								label={t("listings.type")}
								options={PROPERTY_TYPES.map((value) => ({
									value,
									label: t(`agency.propertyTypes.${value}`),
								}))}
								value={type}
								onValueChange={setType}
							/>
							<Select
								value={priceBand}
								onValueChange={(value) => {
									const next = PRICE_BAND_IDS.find(
										(option) => option === value,
									);
									if (next) {
										setPriceBand(next);
									}
								}}
							>
								<SelectTrigger
									aria-label={t("listings.price")}
									className="h-9 w-auto gap-2"
								>
									<span className="text-muted-foreground">
										{t("listings.priceLabel")}
									</span>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{PRICE_BAND_IDS.map((option) => (
										<SelectItem key={option} value={option}>
											{t(`listings.priceBands.${option}`)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</>
					}
					bulkActions={(selected) => (
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="h-9"
							onClick={() =>
								downloadCsv(
									"listings-selected.csv",
									toCsv(selected, listingCsvColumns(t)),
								)
							}
						>
							<DownloadSimpleIcon />
							{t("table.exportSelected")}
						</Button>
					)}
					rowMenu={(row) => (
						<>
							<DropdownMenuItem asChild>
								<Link
									to="/app/listings/$listingId"
									params={{ listingId: row.id }}
								>
									{t("listings.open")}
								</Link>
							</DropdownMenuItem>
							<DropdownMenuItem
								onSelect={() =>
									copyToClipboard(row.id, {
										done: t("table.copied"),
										failed: t("table.copyFailed"),
									})
								}
							>
								{t("listings.copyId")}
							</DropdownMenuItem>
						</>
					)}
					columns={[
						{
							id: "home",
							header: t("listings.home"),
							sortValue: (row) => row.street,
							cell: (row) => (
								<div className="flex items-center gap-4">
									<PropertyTile type={row.type} className="size-12" />
									<div className="grid min-w-48 gap-0.5">
										<Link
											to="/app/listings/$listingId"
											params={{ listingId: row.id }}
											className="truncate font-medium hover:underline"
											dir="auto"
										>
											{row.street}
										</Link>
										<span className="truncate text-muted-foreground text-xs">
											{row.unit === null
												? row.neighborhood
												: `${row.unit} · ${row.neighborhood}`}
										</span>
									</div>
								</div>
							),
						},
						{
							id: "price",
							header: t("listings.price"),
							hideable: true,
							sortValue: (row) => row.askingPrice,
							cell: (row) => (
								<span className="tabular-nums">
									{money.format(row.askingPrice)}
								</span>
							),
						},
						{
							id: "type",
							header: t("listings.type"),
							hideable: true,
							sortValue: (row) => t(`agency.propertyTypes.${row.type}`),
							cell: (row) => t(`agency.propertyTypes.${row.type}`),
						},
						{
							id: "enquiries",
							header: t("listings.enquiries"),
							hideable: true,
							sortValue: (row) => row.enquiryCount,
							cell: (row) => (
								<span className="tabular-nums">
									{number.format(row.enquiryCount)}
								</span>
							),
						},
						{
							id: "id",
							header: t("listings.id"),
							hideable: true,
							cell: (row) => <span className="tabular-nums">{row.id}</span>,
						},
						{
							id: "views",
							header: t("listings.views"),
							hideable: true,
							cell: (row) => (
								<span className="flex items-center gap-1.5 tabular-nums">
									<EyeIcon className="size-4 text-muted-foreground" />
									{number.format(row.portalViews)}
								</span>
							),
						},
						{
							id: "status",
							header: t("listings.status"),
							hideable: true,
							sortValue: (row) => LISTING_STATUSES.indexOf(row.status),
							cell: (row) => <ListingStatusBadge status={row.status} />,
						},
					]}
				/>
			</div>
		</div>
	);
}

/** Placeholder while the loader runs. The route sets it as pendingComponent. */
export function ListingsPageSkeleton() {
	return (
		<div className="grid gap-4">
			<Skeleton className="h-9 w-48" />
			<div className="grid @4xl/main:grid-cols-4 @xl/main:grid-cols-2 gap-4">
				{SKELETON_FIGURES.map((key) => (
					<Skeleton key={key} className="h-28" />
				))}
			</div>
			<Skeleton className="h-160" />
		</div>
	);
}

/** Error state when a loader of the listing pages fails. Try again runs the loader again. */
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
