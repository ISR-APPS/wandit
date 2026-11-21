// The customer page behind login, in the anatomy of the kit user list: the title and the export,
// then the table with a search, the Segment, Region, and Orders filters, a column menu, row checkboxes, and pages.
// The /app/customers route renders it after its loader. The route also uses the skeleton and the error below.
// A customer name puts the customer in the URL (?customer=), and the side sheet shows that customer.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	type CsvColumn,
	CustomerAvatar,
	copyToClipboard,
	downloadCsv,
	formatRelativeTime,
	moneyFormat,
	SALES_AREAS,
	salesAreaOf,
	toCsv,
} from "~/features/shop";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
} from "~/shared/ui/dropdown-menu";
import {
	type RecordColumn,
	RecordFilter,
	RecordTable,
} from "~/shared/ui/record-table";
import { Skeleton } from "~/shared/ui/skeleton";
import { type Customer, customersQueryOptions } from "../api/customers.queries";
import { CUSTOMER_SEGMENTS, LOYAL_FROM_ORDERS } from "../lib/segment";
import { CustomerSheet } from "./customer-sheet";
import { SegmentBadge } from "./segment-badge";

const routeApi = getRouteApi("/app/customers");

/** The bands of the Orders filter. The last band starts at the loyal count of the segment rule. */
const ORDER_COUNT_BANDS = ["one", "few", "many"] as const;

type OrderCountBand = (typeof ORDER_COUNT_BANDS)[number];

// The band of an order count: 1, then 2 up to the loyal count, then the loyal count and more.
function orderCountBandOf(orderCount: number): OrderCountBand {
	if (orderCount <= 1) {
		return "one";
	}
	return orderCount < LOYAL_FROM_ORDERS ? "few" : "many";
}

/** The list page. The three filters cut the rows; then RecordTable searches, sorts, and pages them. */
export function CustomersPage() {
	const { t, locale } = useT();
	const { data: customers } = useSuspenseQuery(customersQueryOptions());
	const { customer: customerId } = routeApi.useSearch();
	const navigate = routeApi.useNavigate();
	const [segment, setSegment] = useState<string | null>(null);
	const [area, setArea] = useState<string | null>(null);
	const [orderBand, setOrderBand] = useState<string | null>(null);
	// The id of the customer that the sheet showed last. The sheet keeps this customer while it slides out.
	const [closingId, setClosingId] = useState<string | null>(null);

	const number = new Intl.NumberFormat(locale);
	const money = moneyFormat(locale);
	const now = Date.now();
	const openCustomer = customers.find((row) => row.id === customerId) ?? null;
	const sheetCustomer =
		openCustomer ?? customers.find((row) => row.id === closingId) ?? null;

	function openPanel(customer: Customer) {
		navigate({ search: { customer: customer.id }, replace: true });
	}

	const rows = customers.filter(
		(row) =>
			(segment === null || row.segment === segment) &&
			(area === null || salesAreaOf(row.region) === area) &&
			(orderBand === null || orderCountBandOf(row.orderCount) === orderBand),
	);

	const csvColumns: CsvColumn<Customer>[] = [
		{ header: t("customers.customer"), value: (row) => row.name },
		{ header: t("customers.email"), value: (row) => row.email },
		{
			header: t("customers.place"),
			value: (row) => `${row.city}, ${row.region}`,
		},
		{ header: t("customers.orders"), value: (row) => String(row.orderCount) },
		{ header: t("customers.spent"), value: (row) => String(row.spent) },
		{ header: t("customers.lastOrder"), value: (row) => row.lastOrderAt },
		{
			header: t("customers.segment"),
			value: (row) => t(`customers.segments.${row.segment}`),
		},
	];

	const columns: RecordColumn<Customer>[] = [
		{
			id: "customer",
			header: t("customers.customer"),
			sortValue: (row) => row.name,
			cell: (row) => (
				<div className="flex items-center gap-4">
					<CustomerAvatar name={row.name} />
					<button
						type="button"
						className="max-w-48 truncate pe-0.5 text-start font-medium hover:underline"
						dir="auto"
						onClick={() => openPanel(row)}
					>
						{row.name}
					</button>
				</div>
			),
		},
		{
			id: "orders",
			header: t("customers.orders"),
			hideable: true,
			sortValue: (row) => row.orderCount,
			cell: (row) => (
				<span className="tabular-nums">{number.format(row.orderCount)}</span>
			),
		},
		{
			id: "spent",
			header: t("customers.spent"),
			hideable: true,
			sortValue: (row) => row.spent,
			cell: (row) => (
				<span className="tabular-nums">{money.format(row.spent)}</span>
			),
		},
		{
			id: "email",
			header: t("customers.email"),
			hideable: true,
			sortValue: (row) => row.email,
			cell: (row) => row.email,
		},
		{
			id: "place",
			header: t("customers.place"),
			hideable: true,
			sortValue: (row) => `${row.region} ${row.city}`,
			cell: (row) => <bdi>{`${row.city}, ${row.region}`}</bdi>,
		},
		{
			id: "lastOrder",
			header: t("customers.lastOrder"),
			hideable: true,
			sortValue: (row) => Date.parse(row.lastOrderAt),
			cell: (row) => formatRelativeTime(row.lastOrderAt, now, locale),
		},
		{
			id: "segment",
			header: t("customers.segment"),
			hideable: true,
			sortValue: (row) => CUSTOMER_SEGMENTS.indexOf(row.segment),
			cell: (row) => <SegmentBadge segment={row.segment} />,
		},
	];

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("customers.title")}
				actions={
					<Button
						type="button"
						disabled={rows.length === 0}
						onClick={() =>
							downloadCsv("customers.csv", toCsv(rows, csvColumns))
						}
					>
						<DownloadSimpleIcon />
						{t("common.exportCsv")}
					</Button>
				}
			/>
			{customers.length === 0 ? (
				<p className="rounded-md border p-10 text-center text-muted-foreground text-sm">
					{t("customers.empty")}
				</p>
			) : (
				<RecordTable
					rows={rows}
					columns={columns}
					searchText={(row) =>
						`${row.name} ${row.email} ${row.city} ${row.region}`
					}
					searchPlaceholder={t("customers.search")}
					selectable
					pageSize={10}
					noResults={t("customers.noResults")}
					toolbar={
						<>
							<RecordFilter
								label={t("customers.segment")}
								options={CUSTOMER_SEGMENTS.map((value) => ({
									value,
									label: t(`customers.segments.${value}`),
								}))}
								value={segment}
								onValueChange={setSegment}
							/>
							<RecordFilter
								label={t("customers.region")}
								options={SALES_AREAS.map((value) => ({
									value,
									label: t(`areas.${value}`),
								}))}
								value={area}
								onValueChange={setArea}
							/>
							<RecordFilter
								label={t("customers.orders")}
								options={ORDER_COUNT_BANDS.map((value) => ({
									value,
									label: t(`customers.orderBands.${value}`),
								}))}
								value={orderBand}
								onValueChange={setOrderBand}
							/>
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
									"customers-selected.csv",
									toCsv(selected, csvColumns),
								)
							}
						>
							<DownloadSimpleIcon />
							{t("table.exportSelected")}
						</Button>
					)}
					rowMenu={(row) => (
						<>
							<DropdownMenuLabel>{t("table.actions")}</DropdownMenuLabel>
							<DropdownMenuSeparator />
							<DropdownMenuItem onSelect={() => openPanel(row)}>
								{t("customers.open")}
							</DropdownMenuItem>
							<DropdownMenuItem
								onSelect={() =>
									copyToClipboard(row.email, {
										done: t("table.copied"),
										failed: t("table.copyFailed"),
									})
								}
							>
								{t("customers.copyEmail")}
							</DropdownMenuItem>
						</>
					)}
				/>
			)}
			<CustomerSheet
				customer={sheetCustomer}
				open={openCustomer !== null}
				onOpenChange={(open) => {
					if (!open) {
						setClosingId(openCustomer?.id ?? null);
						navigate({ search: {}, replace: true });
					}
				}}
			/>
		</div>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8"];

/** Placeholder while the customer loader runs. The route sets it as pendingComponent. */
export function CustomersPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex items-end justify-between gap-3">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-9 w-32" />
			</div>
			<Skeleton className="h-9 w-full sm:max-w-sm" />
			<div className="grid gap-2">
				{SKELETON_ROWS.map((key) => (
					<Skeleton key={key} className="h-14 w-full" />
				))}
			</div>
		</div>
	);
}

/** Error state of the customer page when the loader fails. Try again runs the loader again. */
export function CustomersPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("customers.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
