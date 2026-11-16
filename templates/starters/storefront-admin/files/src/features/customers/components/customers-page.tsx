// The customer page behind login: four figures, the segment tabs, and the searchable customer table.
// The /app/customers route renders it after its loader. The route also uses the skeleton and the error below.
// A customer name puts the customer in the URL (?customer=), and the side sheet shows that customer.
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	CustomerAvatar,
	formatRelativeTime,
	moneyFormat,
} from "~/features/shop";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";
import { DataTable, type DataTableColumn } from "~/shared/ui/data-table";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { type Customer, customersQueryOptions } from "../api/customers.queries";
import { CUSTOMER_SEGMENTS, type CustomerSegment } from "../lib/segment";
import { CustomerFacts } from "./customer-facts";
import { CustomerSheet } from "./customer-sheet";
import { SegmentBadge } from "./segment-badge";

const routeApi = getRouteApi("/app/customers");

/** The list page. The segment tab cuts the rows; then DataTable searches, sorts, and pages them. */
export function CustomersPage() {
	const { t, locale } = useT();
	const { data: customers } = useSuspenseQuery(customersQueryOptions());
	const { customer: customerId } = routeApi.useSearch();
	const navigate = routeApi.useNavigate();
	const [segment, setSegment] = useState<CustomerSegment | "all">("all");
	// The id of the customer that the sheet showed last. The sheet keeps this customer while it slides out.
	const [closingId, setClosingId] = useState<string | null>(null);

	const number = new Intl.NumberFormat(locale);
	const money = moneyFormat(locale);
	const now = Date.now();
	const openCustomer = customers.find((row) => row.id === customerId) ?? null;
	const sheetCustomer =
		openCustomer ?? customers.find((row) => row.id === closingId) ?? null;

	// A tab shows only for a segment that has rows.
	const tabs = CUSTOMER_SEGMENTS.map((value) => ({
		value,
		count: customers.filter((row) => row.segment === value).length,
	})).filter((tab) => tab.count > 0);
	const activeSegment = tabs.some((tab) => tab.value === segment)
		? segment
		: "all";
	const rows =
		activeSegment === "all"
			? customers
			: customers.filter((row) => row.segment === activeSegment);

	const columns: DataTableColumn<Customer>[] = [
		{
			id: "customer",
			header: t("customers.customer"),
			sortValue: (row) => row.name,
			cell: (row) => (
				<div className="flex items-center gap-3">
					<CustomerAvatar name={row.name} className="@3xl/main:flex hidden" />
					{/* On a phone the card edge falls on the end of the Spent column, so no badge is cut in the middle. */}
					{/* 15.625rem is the card padding and border, three cell paddings, and the next two cells (w-22, w-20). */}
					<div className="grid @5xl/main:w-64 @md/main:w-40 w-[calc(100cqw-15.625rem)] justify-items-start">
						{/* pe-0.5: the font draws the dot of a last "i" past the text box, and truncate clips it without this padding. */}
						<button
							type="button"
							className="relative max-w-full truncate rounded-sm pe-0.5 text-start font-medium outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 max-sm:before:absolute max-sm:before:-inset-3"
							dir="auto"
							onClick={() =>
								navigate({ search: { customer: row.id }, replace: true })
							}
						>
							{row.name}
						</button>
						<span className="max-w-full truncate text-muted-foreground text-xs">
							{row.email}
						</span>
					</div>
				</div>
			),
		},
		{
			id: "segment",
			header: t("customers.segment"),
			sortValue: (row) => CUSTOMER_SEGMENTS.indexOf(row.segment),
			cell: (row) => (
				<div className="@md/main:w-auto w-22">
					<SegmentBadge segment={row.segment} />
				</div>
			),
		},
		{
			id: "spent",
			header: t("customers.spent"),
			align: "end",
			sortValue: (row) => row.spent,
			cell: (row) => (
				<div className="@md/main:w-auto w-20">{money.format(row.spent)}</div>
			),
		},
		{
			id: "orders",
			header: t("customers.orders"),
			align: "end",
			sortValue: (row) => row.orderCount,
			cell: (row) => number.format(row.orderCount),
		},
		{
			id: "lastOrder",
			header: t("customers.lastOrder"),
			sortValue: (row) => Date.parse(row.lastOrderAt),
			cell: (row) => formatRelativeTime(row.lastOrderAt, now, locale),
		},
		{
			id: "place",
			header: t("customers.place"),
			sortValue: (row) => `${row.region} ${row.city}`,
			cell: (row) => <bdi>{`${row.city}, ${row.region}`}</bdi>,
		},
	];

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("customers.title")}
				description={t("customers.description")}
			/>
			{customers.length === 0 ? (
				<Card>
					<CardContent className="py-10 text-center text-muted-foreground text-sm">
						{t("customers.empty")}
					</CardContent>
				</Card>
			) : (
				<>
					<CustomerFacts customers={customers} />
					<Card>
						{/* A narrower padding on a phone gives the table room for its first three columns. */}
						<CardContent className="@md/main:px-6 px-4">
							<DataTable
								rows={rows}
								columns={columns}
								searchText={(row) =>
									`${row.name} ${row.email} ${row.city} ${row.region}`
								}
								noResults={t("customers.noResults")}
								toolbar={
									<Tabs
										value={activeSegment}
										onValueChange={(value) =>
											setSegment(
												CUSTOMER_SEGMENTS.find((option) => option === value) ??
													"all",
											)
										}
										className="max-w-full"
									>
										{/* On a narrow card the tabs wrap to a second line, so no tab label is cut. */}
										<TabsList className="flex-wrap group-data-[orientation=horizontal]/tabs:h-auto">
											<TabsTrigger value="all">
												{t("customers.all")}
												<span className="text-muted-foreground tabular-nums">
													{number.format(customers.length)}
												</span>
											</TabsTrigger>
											{tabs.map((tab) => (
												<TabsTrigger key={tab.value} value={tab.value}>
													{t(`customers.segments.${tab.value}`)}
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
				</>
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
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-4 w-72" />
			</div>
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
