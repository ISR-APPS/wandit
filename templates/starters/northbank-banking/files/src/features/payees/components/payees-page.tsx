// The saved payees: group tabs, search, sort, and one row per payee with its last payment and its 90-day total.
// The /app/payees route renders it after its loader. The route also uses the skeleton and the error below.
// The tabs count the payees, so each count equals the rows that its tab shows.
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	FilterTabs,
	MoneyText,
	PAYEE_CATEGORIES,
	type PayeeCategory,
	relativeDayLabel,
	todayIsoDay,
	useIsWideWindow,
} from "~/features/bank";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";
import { DataTable, type DataTableColumn } from "~/shared/ui/data-table";
import { useSidebar } from "~/shared/ui/sidebar";
import { Skeleton } from "~/shared/ui/skeleton";
import { payeesQueryOptions } from "../api/payees.queries";
import type { PayeeSummary } from "../lib/payee-summary";

/**
 * The list page. The tab filters the rows; then DataTable searches, sorts, and pages them.
 * Under 80rem the bank column goes, because the detail page shows the bank. A phone keeps two columns.
 */
export function PayeesPage() {
	const { t, locale } = useT();
	const { data: summaries } = useSuspenseQuery(payeesQueryOptions());
	const [category, setCategory] = useState<PayeeCategory | "all">("all");
	const { isMobile: isPhone } = useSidebar();
	const isWide = useIsWideWindow();

	const number = new Intl.NumberFormat(locale);
	const today = todayIsoDay();
	const tabs = [
		{ value: "all" as const, label: t("payees.all"), count: summaries.length },
		...PAYEE_CATEGORIES.map((value) => ({
			value,
			label: t(`payees.tabs.${value}`),
			count: summaries.filter((summary) => summary.payee.category === value)
				.length,
		})).filter((tab) => tab.count > 0),
	];
	const rows =
		category === "all"
			? summaries
			: summaries.filter((summary) => summary.payee.category === category);

	const nameColumn: DataTableColumn<PayeeSummary> = {
		id: "name",
		header: t("payees.name"),
		sortValue: (row) => row.payee.name,
		cell: (row) => (
			<div className="grid min-w-0 justify-items-start">
				<Link
					to="/app/payees/$payeeId"
					params={{ payeeId: row.payee.id }}
					className="text-pretty font-medium hover:underline"
				>
					{row.payee.name}
				</Link>
				<span className="text-pretty text-muted-foreground text-xs">
					{isPhone
						? t(`payees.categories.${row.payee.category}`)
						: row.payee.note}
				</span>
			</div>
		),
	};
	const paidColumn: DataTableColumn<PayeeSummary> = {
		id: "paid",
		header: t("payees.paid"),
		align: "end",
		sortValue: (row) => row.paidCents,
		cell: (row) => <MoneyText amountCents={row.paidCents} withCents={false} />,
	};
	const bankColumn: DataTableColumn<PayeeSummary> = {
		id: "bank",
		header: t("payees.bank"),
		sortValue: (row) => row.payee.bankName,
		cell: (row) => (
			<span className="whitespace-nowrap">
				{t(`methods.${row.payee.method}`)}
				<span className="text-muted-foreground tabular-nums">
					{` · ••${row.payee.accountEnding}`}
				</span>
			</span>
		),
	};
	const columns: DataTableColumn<PayeeSummary>[] = isPhone
		? [nameColumn, paidColumn]
		: [
				nameColumn,
				{
					id: "category",
					header: t("payees.category"),
					sortValue: (row) => PAYEE_CATEGORIES.indexOf(row.payee.category),
					cell: (row) => (
						<Badge variant="secondary">
							{t(`payees.categories.${row.payee.category}`)}
						</Badge>
					),
				},
				...(isWide ? [bankColumn] : []),
				{
					id: "lastPaid",
					header: t("payees.lastPaid"),
					sortValue: (row) => row.lastPaidDay ?? "",
					cell: (row) => (
						<span className="whitespace-nowrap text-muted-foreground">
							{row.lastPaidDay
								? relativeDayLabel(row.lastPaidDay, today, locale)
								: t("payees.never")}
						</span>
					),
				},
				{
					id: "count",
					header: t("payees.payments"),
					align: "end",
					sortValue: (row) => row.paymentCount,
					cell: (row) => number.format(row.paymentCount),
				},
				paidColumn,
			];

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("payees.title")}
				description={t("payees.description")}
			/>
			<Card>
				<CardContent className="max-md:px-3">
					<DataTable
						rows={rows}
						columns={columns}
						searchText={(row) =>
							`${row.payee.name} ${row.payee.note} ${row.payee.bankName}`
						}
						noResults={t("payees.noResults")}
						toolbar={
							<FilterTabs
								value={category}
								options={tabs}
								onValueChange={setCategory}
								label={t("payees.category")}
							/>
						}
					/>
				</CardContent>
			</Card>
		</div>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8"];

/** Placeholder while the list loader runs. The route sets it as pendingComponent. */
export function PayeesPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-32" />
				<Skeleton className="h-4 w-72 max-w-full" />
			</div>
			<Card>
				<CardContent className="grid gap-3">
					<Skeleton className="h-9 w-full sm:max-w-md" />
					{SKELETON_ROWS.map((key) => (
						<Skeleton key={key} className="h-11 w-full" />
					))}
				</CardContent>
			</Card>
		</div>
	);
}

/** Error state of the payee pages when a loader fails. Try again runs the loader again. */
export function PayeesPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("payees.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
