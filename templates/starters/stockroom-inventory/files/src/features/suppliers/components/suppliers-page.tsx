// The supplier list behind login, in the anatomy of the kit user list: the title row,
// a toolbar (search, Status, Family, and Order day filters, Columns), and a table with checkboxes, a row menu, and pages.
// The /app/suppliers route renders it after its loader. The route also uses the skeleton and the error below.
// The filters stay in the page state. The row menu links to the item and order lists of the supplier.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	type CsvColumn,
	copyToClipboard,
	dayCountFormat,
	downloadCsv,
	InitialsTile,
	LoadError,
	STOCK_CATEGORIES,
	toCsv,
} from "~/features/stock";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import {
	type RecordColumn,
	RecordFilter,
	RecordTable,
} from "~/shared/ui/record-table";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	SUPPLIER_STATUSES,
	type Supplier,
	type SupplierStatus,
	suppliersQueryOptions,
} from "../api/suppliers.queries";

// Red for a late order, amber for a weak on-time rate, green for the rest. The label always names the status.
const STATUS_VARIANT = {
	late: "destructive",
	watch: "warning",
	onTrack: "success",
} satisfies Record<SupplierStatus, "destructive" | "warning" | "success">;

// The weekly order run is on a weekday from 1 (Monday) to 5 (Friday).
const ORDER_WEEKDAYS = [1, 2, 3, 4, 5];
// Ten rows per page, as the kit user list shows.
const PAGE_SIZE = 10;

/** The list page. The filters apply first; RecordTable then searches, sorts, selects, and pages. */
export function SuppliersPage() {
	const { t, locale } = useT();
	const { data: suppliers } = useSuspenseQuery(suppliersQueryOptions());
	const [status, setStatus] = useState<string | null>(null);
	const [category, setCategory] = useState<string | null>(null);
	const [orderDay, setOrderDay] = useState<string | null>(null);
	const dayCount = dayCountFormat(locale);
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 0,
	});
	const weekday = new Intl.DateTimeFormat(locale, { weekday: "long" });
	// 1 January 2024 is a Monday, so day N of that month names weekday N (1 = Monday, 5 = Friday).
	const weekdayName = (day: number) => weekday.format(new Date(2024, 0, day));

	const rows = suppliers.filter(
		(supplier) =>
			(status === null || supplier.status === status) &&
			(category === null ||
				supplier.categories.some((entry) => entry === category)) &&
			(orderDay === null || String(supplier.orderWeekday) === orderDay),
	);

	const csvColumns: CsvColumn<Supplier>[] = [
		{ header: t("suppliers.name"), value: (supplier) => supplier.name },
		{
			header: t("suppliers.contact"),
			value: (supplier) => supplier.contactName,
		},
		{ header: t("suppliers.email"), value: (supplier) => supplier.email },
		{ header: t("suppliers.phone"), value: (supplier) => supplier.phone },
		{ header: t("suppliers.city"), value: (supplier) => supplier.city },
		{
			header: t("suppliers.leadTime"),
			value: (supplier) => dayCount.format(supplier.leadTimeDays),
		},
		{
			header: t("suppliers.orderDay"),
			value: (supplier) => weekdayName(supplier.orderWeekday),
		},
		{
			header: t("suppliers.onTimeRate"),
			value: (supplier) =>
				supplier.onTimeRate === null ? "" : percent.format(supplier.onTimeRate),
		},
		{
			header: t("suppliers.status"),
			value: (supplier) => t(`suppliers.statuses.${supplier.status}`),
		},
	];

	function exportRows(fileName: string, selected: Supplier[]) {
		downloadCsv(fileName, toCsv(selected, csvColumns));
	}

	const columns: RecordColumn<Supplier>[] = [
		{
			id: "name",
			header: t("suppliers.name"),
			sortValue: (supplier) => supplier.name,
			cell: (supplier) => (
				<span className="flex items-center gap-3">
					<InitialsTile name={supplier.name} className="rounded-full" />
					<Link
						to="/app/purchase-orders"
						search={{ supplier: supplier.id }}
						className="font-medium hover:underline"
						dir="auto"
					>
						{supplier.name}
					</Link>
				</span>
			),
		},
		{
			id: "contact",
			header: t("suppliers.contact"),
			hideable: true,
			sortValue: (supplier) => supplier.contactName,
			cell: (supplier) => supplier.contactName,
		},
		{
			id: "lead-time",
			header: t("suppliers.leadTime"),
			hideable: true,
			sortValue: (supplier) => supplier.leadTimeDays,
			cell: (supplier) => (
				<span className="whitespace-nowrap tabular-nums">
					{dayCount.format(supplier.leadTimeDays)}
				</span>
			),
		},
		{
			id: "email",
			header: t("suppliers.email"),
			hideable: true,
			cell: (supplier) => supplier.email,
		},
		{
			id: "city",
			header: t("suppliers.city"),
			hideable: true,
			sortValue: (supplier) => supplier.city,
			cell: (supplier) => supplier.city,
		},
		{
			id: "on-time",
			header: t("suppliers.onTimeRate"),
			hideable: true,
			// A supplier with no delivery yet sorts first.
			sortValue: (supplier) => supplier.onTimeRate ?? -1,
			cell: (supplier) => (
				<span className="tabular-nums">
					{supplier.onTimeRate === null
						? "–"
						: percent.format(supplier.onTimeRate)}
				</span>
			),
		},
		{
			id: "status",
			header: t("suppliers.status"),
			sortValue: (supplier) => SUPPLIER_STATUSES.indexOf(supplier.status),
			cell: (supplier) => (
				<Badge variant={STATUS_VARIANT[supplier.status]}>
					{t(`suppliers.statuses.${supplier.status}`)}
				</Badge>
			),
		},
	];

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("suppliers.title")}
				actions={
					<Button
						type="button"
						onClick={() => exportRows("suppliers.csv", rows)}
					>
						<DownloadSimpleIcon />
						{t("common.exportCsv")}
					</Button>
				}
			/>
			<RecordTable
				rows={rows}
				columns={columns}
				searchText={(supplier) =>
					`${supplier.name} ${supplier.contactName} ${supplier.email} ${supplier.city}`
				}
				searchPlaceholder={t("suppliers.search")}
				toolbar={
					<>
						<RecordFilter
							label={t("suppliers.status")}
							options={SUPPLIER_STATUSES.map((entry) => ({
								value: entry,
								label: t(`suppliers.statuses.${entry}`),
							}))}
							value={status}
							onValueChange={setStatus}
						/>
						<RecordFilter
							label={t("suppliers.family")}
							options={STOCK_CATEGORIES.map((entry) => ({
								value: entry,
								label: t(`categories.${entry}`),
							}))}
							value={category}
							onValueChange={setCategory}
						/>
						<RecordFilter
							label={t("suppliers.orderDay")}
							options={ORDER_WEEKDAYS.map((day) => ({
								value: String(day),
								label: weekdayName(day),
							}))}
							value={orderDay}
							onValueChange={setOrderDay}
						/>
					</>
				}
				rowMenu={(supplier) => (
					<>
						<DropdownMenuItem asChild>
							<Link
								to="/app/purchase-orders"
								search={{ supplier: supplier.id }}
							>
								{t("suppliers.viewOrders")}
							</Link>
						</DropdownMenuItem>
						<DropdownMenuItem asChild>
							<Link to="/app/items" search={{ supplier: supplier.id }}>
								{t("suppliers.viewItems")}
							</Link>
						</DropdownMenuItem>
						<DropdownMenuItem
							onSelect={() =>
								copyToClipboard(supplier.email, {
									done: t("table.copied"),
									failed: t("table.copyFailed"),
								})
							}
						>
							{t("suppliers.copyEmail")}
						</DropdownMenuItem>
					</>
				)}
				selectable
				bulkActions={(selected) => (
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-9"
						onClick={() => exportRows("suppliers-selected.csv", selected)}
					>
						<DownloadSimpleIcon />
						{t("table.exportSelected")}
					</Button>
				)}
				pageSize={PAGE_SIZE}
				noResults={t("suppliers.noResults")}
			/>
		</div>
	);
}

/** Placeholder while the loader runs. The route sets it as pendingComponent. */
export function SuppliersPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex items-end justify-between gap-3">
				<Skeleton className="h-8 w-48" />
				<Skeleton className="h-9 w-32" />
			</div>
			<Skeleton className="h-9 w-full max-w-2xl" />
			<Skeleton className="h-128" />
		</div>
	);
}

/** Error state when the loader fails. */
export function SuppliersPageError() {
	const { t } = useT();
	return <LoadError message={t("suppliers.loadError")} />;
}
