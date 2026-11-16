// The transaction list behind login: the page header, the type tabs, the category filter, and the searchable table.
// The /app/transactions route renders it after its loader. The route also uses the skeleton and the error below.
// The tab and the category live in the URL, so a link from the budgets page opens the list with its filter.
import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { PageHeader } from "~/features/app-shell";
import {
	CATEGORY_IDS,
	type CategoryId,
	TRANSACTION_TYPES,
} from "~/features/ledger";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";
import { DataTable } from "~/shared/ui/data-table";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { transactionsQueryOptions } from "../api/transactions.queries";
import { useTransactionTable } from "../hooks/use-transaction-table";
import type { TransactionsSearch } from "../lib/transactions-search";

// The value of the Select item that removes the category filter. No category has this id.
const ALL_CATEGORIES = "all";

type TransactionsPageProps = {
	/** The filters from the URL: `?type=expense&category=software`. */
	search: TransactionsSearch;
};

/** The list page. The category filters first, then the type tab; DataTable searches, sorts, and pages the rest. */
export function TransactionsPage({ search }: TransactionsPageProps) {
	const { t, locale } = useT();
	const navigate = useNavigate();
	const { data: transactions } = useSuspenseQuery(transactionsQueryOptions());

	const number = new Intl.NumberFormat(locale);
	// The Select lists the categories that have a row. The category of the URL stays, so the trigger never shows empty.
	const categories = CATEGORY_IDS.filter(
		(id) =>
			id === search.category ||
			transactions.some((row) => row.categoryId === id),
	);
	const inCategory = search.category
		? transactions.filter((row) => row.categoryId === search.category)
		: transactions;
	// The tab counts follow the category filter, so a count equals the rows of its tab.
	const tabs = TRANSACTION_TYPES.map((type) => ({
		type,
		count: inCategory.filter((row) => row.type === type).length,
	}));
	const rows = search.type
		? inCategory.filter((row) => row.type === search.type)
		: inCategory;
	const { columns, searchText } = useTransactionTable(rows);

	function changeSearch(next: TransactionsSearch) {
		void navigate({ to: "/app/transactions", search: next, replace: true });
	}

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("transactions.title")}
				description={t("transactions.description")}
			/>
			<Card>
				{/* A smaller side padding on a phone leaves room for the date, the payee, and the amount. */}
				<CardContent className="max-md:px-3">
					<DataTable
						rows={rows}
						columns={columns}
						searchText={searchText}
						noResults={t("transactions.noResults")}
						toolbar={
							<>
								<Tabs
									value={search.type ?? "all"}
									onValueChange={(value) =>
										changeSearch({
											...search,
											type: TRANSACTION_TYPES.find((type) => type === value),
										})
									}
									className="max-w-full overflow-x-auto"
								>
									{/* On a phone the strip is 44 px high, the smallest comfortable touch area. */}
									<TabsList className="max-md:group-data-[orientation=horizontal]/tabs:h-11">
										<TabsTrigger value="all">
											{t("transactions.all")}
											<span className="text-muted-foreground tabular-nums">
												{number.format(inCategory.length)}
											</span>
										</TabsTrigger>
										{/* A tab with no row stays, so the strip does not move when the category changes. */}
										{tabs.map((tab) => (
											<TabsTrigger key={tab.type} value={tab.type}>
												{t(`transactions.tabs.${tab.type}`)}
												<span className="text-muted-foreground tabular-nums">
													{number.format(tab.count)}
												</span>
											</TabsTrigger>
										))}
									</TabsList>
								</Tabs>
								<Select
									value={search.category ?? ALL_CATEGORIES}
									onValueChange={(value) =>
										changeSearch({
											...search,
											category: categories.find((id) => id === value),
										})
									}
								>
									<SelectTrigger
										aria-label={t("transactions.category")}
										className="w-full max-md:h-11 sm:ms-auto sm:w-52"
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent align="end">
										<SelectItem value={ALL_CATEGORIES}>
											{t("transactions.allCategories")}
										</SelectItem>
										{categories.map((id: CategoryId) => (
											<SelectItem key={id} value={id}>
												{t(`categories.${id}`)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</>
						}
					/>
				</CardContent>
			</Card>
		</div>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

/** Placeholder while the list loader runs. The route sets it as pendingComponent. */
export function TransactionsPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-48" />
				<Skeleton className="h-4 w-72 max-w-full" />
			</div>
			<Card>
				<CardContent className="grid gap-3">
					<div className="flex flex-wrap gap-2">
						<Skeleton className="h-9 w-full sm:max-w-xs" />
						<Skeleton className="h-9 w-72 max-w-full" />
					</div>
					{SKELETON_ROWS.map((key) => (
						<Skeleton key={key} className="h-11 w-full" />
					))}
				</CardContent>
			</Card>
		</div>
	);
}

/** Error state of the list and of the detail page when a loader fails. Try again runs the loader again. */
export function TransactionsPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("transactions.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
