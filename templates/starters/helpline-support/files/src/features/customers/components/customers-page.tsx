// The customers page behind login: every company with its main contact, plan, city, and health.
// The /app/customers route renders it after its loader. A company name opens the customer sheet (?customer=).
// The plan filter lives in the URL (?plan=). The route also uses the skeleton and the error below.
// It follows the user list page of the kit system: filter field, filter buttons, columns, checkboxes, pages.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, useRouter } from "@tanstack/react-router";
import type { VariantProps } from "class-variance-authority";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	CUSTOMER_PLANS,
	copyToClipboard,
	downloadCsv,
	PersonAvatar,
	toCsv,
} from "~/features/helpdesk";
import { useT } from "~/shared/i18n";
import { Badge, type badgeVariants } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import {
	type RecordColumn,
	RecordFilter,
	RecordTable,
} from "~/shared/ui/record-table";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	type CustomerListItem,
	customersQueryOptions,
} from "../api/customers.queries";
import { customerCsvColumns } from "../lib/customer-csv";
import {
	CUSTOMER_HEALTHS,
	type CustomerHealth,
	customerHealth,
} from "../lib/customer-health";
import { CustomerSheet } from "./customer-sheet";

const route = getRouteApi("/app/customers");

// Ten rows per page, as the user list of the kit. The 40 companies fill 4 pages.
const CUSTOMERS_PAGE_SIZE = 10;

/** Badge look per health. At risk has no tinted kit variant, so it follows the recipe of the success variant. */
const HEALTH_BADGE = {
	healthy: { variant: "success", className: "" },
	watch: { variant: "warning", className: "" },
	at_risk: {
		variant: "outline",
		className: "border-destructive/25 bg-destructive/12 text-destructive",
	},
} satisfies Record<
	CustomerHealth,
	{ variant: VariantProps<typeof badgeVariants>["variant"]; className: string }
>;

/** The list page. The filter buttons narrow the rows; then RecordTable searches, sorts, and pages them. */
export function CustomersPage() {
	const { t, locale } = useT();
	const { data: customers } = useSuspenseQuery(customersQueryOptions());
	const { plan, customer: customerId } = route.useSearch();
	const navigate = route.useNavigate();
	const [health, setHealth] = useState<string | null>(null);
	const [city, setCity] = useState<string | null>(null);
	const cities = [...new Set(customers.map((row) => row.city))].sort(
		(first, second) => first.localeCompare(second, locale),
	);
	const rows = customers.filter(
		(row) =>
			(plan === undefined || row.plan === plan) &&
			(health === null || customerHealth(row) === health) &&
			(city === null || row.city === city),
	);
	const selected = customers.find((row) => row.id === customerId) ?? null;

	const openCustomer = (id: string | undefined) =>
		navigate({ search: (previous) => ({ ...previous, customer: id }) });

	const columns: RecordColumn<CustomerListItem>[] = [
		{
			id: "name",
			header: t("customers.company"),
			// The button covers the cell and its padding (after:-inset-2), so a tap anywhere in the cell opens the sheet.
			cell: (row) => (
				<span className="relative flex min-w-48 items-center gap-3">
					<PersonAvatar name={row.name} className="size-8" />
					<button
						type="button"
						onClick={() => openCustomer(row.id)}
						className="text-start after:absolute after:-inset-2 hover:underline"
						dir="auto"
					>
						{row.name}
					</button>
				</span>
			),
		},
		{
			id: "contact",
			header: t("customers.contactRole"),
			hideable: true,
			sortValue: (row) => row.contacts[0]?.title ?? "",
			cell: (row) => (
				<span className="whitespace-nowrap" dir="auto">
					{row.contacts[0]?.title ?? "–"}
				</span>
			),
		},
		{
			id: "plan",
			header: t("customers.plan"),
			hideable: true,
			sortValue: (row) => CUSTOMER_PLANS.indexOf(row.plan),
			cell: (row) => t(`customers.plans.${row.plan}`),
		},
		{
			id: "email",
			header: t("customers.email"),
			hideable: true,
			sortValue: (row) => row.contacts[0]?.email ?? "",
			cell: (row) => (
				<bdi className="whitespace-nowrap">{row.contacts[0]?.email ?? "–"}</bdi>
			),
		},
		{
			id: "city",
			header: t("customers.city"),
			hideable: true,
			sortValue: (row) => row.city,
			cell: (row) => row.city,
		},
		{
			id: "health",
			header: t("customers.healthLabel"),
			sortValue: (row) => CUSTOMER_HEALTHS.indexOf(customerHealth(row)),
			cell: (row) => {
				const value = customerHealth(row);
				return (
					<Badge
						variant={HEALTH_BADGE[value].variant}
						className={HEALTH_BADGE[value].className}
					>
						{t(`customers.health.${value}`)}
					</Badge>
				);
			},
		},
	];

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("customers.title")}
				actions={
					<Button
						type="button"
						aria-label={t("common.exportCsv")}
						onClick={() =>
							downloadCsv("customers.csv", toCsv(rows, customerCsvColumns(t)))
						}
					>
						<DownloadSimpleIcon />
						<span className="hidden lg:inline">{t("common.exportCsv")}</span>
					</Button>
				}
			/>
			<RecordTable
				rows={rows}
				columns={columns}
				searchText={(row) =>
					`${row.name} ${row.city} ${row.contacts.map((contact) => `${contact.name} ${contact.email}`).join(" ")}`
				}
				searchPlaceholder={t("customers.searchPlaceholder")}
				pageSize={CUSTOMERS_PAGE_SIZE}
				noResults={t("customers.noResults")}
				selectable
				toolbar={
					<>
						<RecordFilter
							label={t("customers.healthLabel")}
							options={CUSTOMER_HEALTHS.map((value) => ({
								value,
								label: t(`customers.health.${value}`),
							}))}
							value={health}
							onValueChange={setHealth}
						/>
						<RecordFilter
							label={t("customers.plan")}
							options={CUSTOMER_PLANS.map((value) => ({
								value,
								label: t(`customers.plans.${value}`),
							}))}
							value={plan ?? null}
							onValueChange={(value) =>
								navigate({
									search: (previous) => ({
										...previous,
										plan: CUSTOMER_PLANS.find((option) => option === value),
									}),
								})
							}
						/>
						<RecordFilter
							label={t("customers.city")}
							options={cities.map((value) => ({ value, label: value }))}
							value={city}
							onValueChange={setCity}
						/>
					</>
				}
				bulkActions={(selectedRows) => (
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-9"
						onClick={() =>
							downloadCsv(
								"customers-selected.csv",
								toCsv(selectedRows, customerCsvColumns(t)),
							)
						}
					>
						<DownloadSimpleIcon />
						{t("table.exportSelected")}
					</Button>
				)}
				rowMenu={(row) => (
					<>
						<DropdownMenuItem onSelect={() => openCustomer(row.id)}>
							{t("customers.openCustomer")}
						</DropdownMenuItem>
						{row.contacts[0] ? (
							<DropdownMenuItem
								onSelect={() =>
									copyToClipboard(row.contacts[0]?.email ?? "", {
										done: t("table.copied"),
										failed: t("table.copyFailed"),
									})
								}
							>
								{t("customers.copyEmail")}
							</DropdownMenuItem>
						) : null}
					</>
				)}
			/>
			<CustomerSheet
				customer={selected}
				onClose={() => openCustomer(undefined)}
			/>
		</div>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

/** Placeholder while the customers loader runs. The route sets it as pendingComponent. */
export function CustomersPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-9 w-32" />
			</div>
			<div className="flex flex-wrap gap-2">
				<Skeleton className="h-9 w-full sm:max-w-sm" />
				<Skeleton className="h-9 w-72" />
			</div>
			<div className="grid gap-2 rounded-md border p-2">
				{SKELETON_ROWS.map((key) => (
					<Skeleton key={key} className="h-12 w-full" />
				))}
			</div>
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
