// The supplier page behind login: a search, a sort, a grid of supplier cards, and the supplier panel.
// The /app/suppliers route renders it after its loader. The route also uses the skeleton and the error below.
// The open panel lives in the URL (?supplier=<id>), so other pages can link to one supplier.
import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import { LoadError, moneyFormat, pluralForm } from "~/features/stock";
import { useT } from "~/shared/i18n";
import { Card, CardContent } from "~/shared/ui/card";
import { MagnifyingGlassIcon } from "~/shared/ui/icons";
import { Input } from "~/shared/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { Skeleton } from "~/shared/ui/skeleton";
import { type Supplier, suppliersQueryOptions } from "../api/suppliers.queries";
import { SupplierCard } from "./supplier-card";
import { SupplierSheet } from "./supplier-sheet";

/** The sort choices of the grid. Ordered value first: the biggest accounts matter most to a buyer. */
const SORTS = ["value", "onTime", "name"] as const;

type Sort = (typeof SORTS)[number];

// One compare function per sort. A supplier with no delivery sorts last on the on-time rate.
const COMPARE: Record<Sort, (first: Supplier, second: Supplier) => number> = {
	value: (first, second) => second.orderedValue - first.orderedValue,
	onTime: (first, second) =>
		(second.onTimeRate ?? -1) - (first.onTimeRate ?? -1),
	name: (first, second) => first.name.localeCompare(second.name),
};

/** The grid of suppliers. The search matches the name, the city, the contact, and the email. */
export function SuppliersPage() {
	const { t, locale } = useT();
	const { data: suppliers } = useSuspenseQuery(suppliersQueryOptions());
	const search = useSearch({ from: "/app/suppliers" });
	const navigate = useNavigate({ from: "/app/suppliers" });
	const [query, setQuery] = useState("");
	const [sort, setSort] = useState<Sort>("value");

	const number = new Intl.NumberFormat(locale);
	const money = moneyFormat(locale, true);
	const needle = query.trim().toLocaleLowerCase(locale);
	const shown = suppliers
		.filter((supplier) =>
			`${supplier.name} ${supplier.city} ${supplier.contactName} ${supplier.email}`
				.toLocaleLowerCase(locale)
				.includes(needle),
		)
		.sort(COMPARE[sort]);
	const openOrders = suppliers.reduce(
		(sum, supplier) => sum + supplier.openOrders,
		0,
	);
	const orderedValue = suppliers.reduce(
		(sum, supplier) => sum + supplier.orderedValue,
		0,
	);
	const selected =
		suppliers.find((supplier) => supplier.id === search.supplier) ?? null;

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("suppliers.title")}
				description={`${number.format(suppliers.length)} ${t(`suppliers.countLabel.${pluralForm(suppliers.length, locale)}`)} · ${number.format(openOrders)} ${t(`suppliers.openOrders.${pluralForm(openOrders, locale)}`)} · ${money.format(orderedValue)} ${t("suppliers.orderedLabel")}`}
			/>
			<div className="flex flex-wrap items-center gap-2">
				<div className="relative w-full sm:max-w-xs">
					<MagnifyingGlassIcon className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						type="search"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder={t("table.search")}
						aria-label={t("table.search")}
						className="ps-8"
					/>
				</div>
				<Select
					value={sort}
					onValueChange={(value) =>
						setSort(SORTS.find((option) => option === value) ?? "value")
					}
				>
					<SelectTrigger
						aria-label={t("suppliers.sort")}
						className="w-full sm:w-52"
					>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{SORTS.map((option) => (
							<SelectItem key={option} value={option}>
								{t(`suppliers.sorts.${option}`)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			{shown.length === 0 ? (
				<Card>
					<CardContent className="py-6 text-center text-muted-foreground text-sm">
						{t("suppliers.noResults")}
					</CardContent>
				</Card>
			) : (
				<div className="grid @2xl/main:grid-cols-2 @4xl/main:grid-cols-3 grid-cols-1 gap-4">
					{shown.map((supplier) => (
						<SupplierCard key={supplier.id} supplier={supplier} />
					))}
				</div>
			)}
			<SupplierSheet
				supplier={selected}
				onClose={() =>
					navigate({
						search: (previous) => ({ ...previous, supplier: undefined }),
						replace: true,
					})
				}
			/>
		</div>
	);
}

// Placeholder cards of the skeleton. Fixed keys, because the cards never reorder.
const SKELETON_CARDS = ["1", "2", "3", "4", "5", "6"];

/** Placeholder while the supplier loader runs. The route sets it as pendingComponent. */
export function SuppliersPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-4 w-72" />
			</div>
			<Skeleton className="h-9 w-full sm:max-w-md" />
			<div className="grid @2xl/main:grid-cols-2 @4xl/main:grid-cols-3 grid-cols-1 gap-4">
				{SKELETON_CARDS.map((key) => (
					<Skeleton key={key} className="h-56 rounded-surface" />
				))}
			</div>
		</div>
	);
}

/** Error state of the supplier page when its loader fails. */
export function SuppliersPageError() {
	const { t } = useT();
	return <LoadError message={t("suppliers.loadError")} />;
}
