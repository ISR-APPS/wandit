// The customers page behind login: every company with its plan, revenue, and support figures, under plan tabs.
// The /app/customers route renders it after its loader. A company name opens the customer sheet (?customer=).
// The route also uses the skeleton and the error below.
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, useRouter } from "@tanstack/react-router";
import { PageHeader } from "~/features/app-shell";
import {
	CUSTOMER_PLANS,
	fillMessage,
	moneyFormat,
	PLAN_BADGE,
} from "~/features/helpdesk";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";
import { DataTable, type DataTableColumn } from "~/shared/ui/data-table";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import {
	CUSTOMER_FIGURE_DAYS,
	type CustomerListItem,
	customersQueryOptions,
} from "../api/customers.queries";
import { CustomerSheet } from "./customer-sheet";

const route = getRouteApi("/app/customers");

// Under this share of good ratings, the satisfaction cell turns red: about one bad rating in five.
const LOW_SATISFACTION = 0.8;

/** The list page. The plan tab filters the rows; then DataTable searches, sorts, and pages them. */
export function CustomersPage() {
	const { t, locale } = useT();
	const { data: customers } = useSuspenseQuery(customersQueryOptions());
	const { plan, customer: customerId } = route.useSearch();
	const navigate = route.useNavigate();

	const number = new Intl.NumberFormat(locale);
	const plural = new Intl.PluralRules(locale);
	const money = moneyFormat(locale);
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 0,
	});
	const tabs = CUSTOMER_PLANS.map((value) => ({
		value,
		count: customers.filter((row) => row.plan === value).length,
	})).filter((tab) => tab.count > 0);
	const activePlan =
		plan && tabs.some((tab) => tab.value === plan) ? plan : "all";
	const rows =
		activePlan === "all"
			? customers
			: customers.filter((row) => row.plan === activePlan);
	const selected = customers.find((row) => row.id === customerId) ?? null;
	const totalMrr = customers.reduce((sum, row) => sum + row.mrr, 0);

	const openCustomer = (id: string | undefined) =>
		navigate({ search: (previous) => ({ ...previous, customer: id }) });

	const columns: DataTableColumn<CustomerListItem>[] = [
		{
			id: "name",
			header: t("customers.company"),
			sortValue: (row) => row.name,
			// The second line holds the ticket volume, so five columns fit beside the sidebar at 1024 px.
			// On a phone the cell takes the visible card width, and its third line shows the plan and the revenue.
			// The button covers the cell and its padding (after:-inset-2), so a tap anywhere in the cell opens the panel.
			cell: (row) => (
				<div className="relative grid @xl/main:min-w-52 min-w-[calc(100cqi-4rem)] justify-items-start gap-0.5">
					<button
						type="button"
						onClick={() => openCustomer(row.id)}
						className="text-start font-medium after:absolute after:-inset-2 hover:underline"
					>
						{row.name}
					</button>
					<span className="text-muted-foreground text-xs">
						{/* PluralRules picks "1 ticket" or "33 tickets" in the app language. */}
						{`${row.city} · ${fillMessage(
							t(
								plural.select(row.recentTicketCount) === "one"
									? "customers.ticketsInDaysOne"
									: "customers.ticketsInDays",
							),
							{
								count: number.format(row.recentTicketCount),
								days: number.format(CUSTOMER_FIGURE_DAYS),
							},
						)}`}
					</span>
					<span className="mt-1 flex @xl/main:hidden items-center gap-2 text-xs">
						<Badge variant={PLAN_BADGE[row.plan]}>
							{t(`customers.plans.${row.plan}`)}
						</Badge>
						<span className="tabular-nums">{money.format(row.mrr)}</span>
					</span>
				</div>
			),
		},
		{
			id: "plan",
			header: t("customers.plan"),
			sortValue: (row) => CUSTOMER_PLANS.indexOf(row.plan),
			cell: (row) => (
				<Badge variant={PLAN_BADGE[row.plan]}>
					{t(`customers.plans.${row.plan}`)}
				</Badge>
			),
		},
		{
			id: "mrr",
			header: t("customers.mrr"),
			align: "end",
			sortValue: (row) => row.mrr,
			cell: (row) => money.format(row.mrr),
		},
		{
			id: "open",
			header: t("customers.openTickets"),
			align: "end",
			sortValue: (row) => row.openTickets,
			cell: (row) => (
				<span className={cn(row.openTickets === 0 && "text-muted-foreground")}>
					{number.format(row.openTickets)}
				</span>
			),
		},
		{
			id: "satisfaction",
			header: t("customers.satisfaction"),
			align: "end",
			sortValue: (row) => row.satisfaction ?? -1,
			cell: (row) =>
				row.satisfaction === null ? (
					<span className="text-muted-foreground">—</span>
				) : (
					<span
						className={cn(
							row.satisfaction < LOW_SATISFACTION &&
								"font-medium text-destructive",
						)}
					>
						{percent.format(row.satisfaction)}
					</span>
				),
		},
	];

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("customers.title")}
				description={fillMessage(t("customers.description"), {
					count: number.format(customers.length),
					mrr: money.format(totalMrr),
				})}
			/>
			<Card>
				<CardContent>
					<DataTable
						rows={rows}
						columns={columns}
						searchText={(row) =>
							`${row.name} ${row.city} ${row.contacts.map((contact) => `${contact.name} ${contact.email}`).join(" ")}`
						}
						noResults={t("customers.noResults")}
						toolbar={
							<Tabs
								value={activePlan}
								onValueChange={(value) =>
									navigate({
										search: (previous) => ({
											...previous,
											plan: CUSTOMER_PLANS.find((option) => option === value),
										}),
									})
								}
								className="max-w-full overflow-x-auto"
							>
								<TabsList>
									<TabsTrigger value="all">
										{t("customers.allPlans")}
										<span className="text-muted-foreground tabular-nums">
											{number.format(customers.length)}
										</span>
									</TabsTrigger>
									{tabs.map((tab) => (
										<TabsTrigger key={tab.value} value={tab.value}>
											{t(`customers.plans.${tab.value}`)}
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
			<CustomerSheet
				customer={selected}
				onClose={() => openCustomer(undefined)}
			/>
		</div>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8"];

/** Placeholder while the customers loader runs. The route sets it as pendingComponent. */
export function CustomersPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-4 w-64" />
			</div>
			<Card>
				<CardContent className="grid gap-3">
					<Skeleton className="h-9 w-full sm:max-w-md" />
					{SKELETON_ROWS.map((key) => (
						<Skeleton key={key} className="h-12 w-full" />
					))}
				</CardContent>
			</Card>
		</div>
	);
}

/** Error state of the customers page when its loader fails. Try again runs the loader again. */
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
