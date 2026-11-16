// The Activity page behind login: the totals strip, the type tabs, the period filter, and the table of every transaction.
// The /app/activity route renders it after its loader. The route also uses the skeleton and the error below.
// A click on a row opens the side panel of that transaction. The open transaction lives in the URL (?tx=).
import { useSuspenseQuery } from "@tanstack/react-query";
import {
	Link,
	useNavigate,
	useRouter,
	useSearch,
} from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	ACCOUNTS,
	AssetGlyph,
	dayCountFormat,
	fillMessage,
	formatPrice,
	formatQuantity,
	formatRelativeTime,
	moneyFormat,
	PERIOD_DAYS,
	type ScreenSize,
	TRANSACTION_STATUS_BADGE,
	TRANSACTION_STATUSES,
	TRANSACTION_TYPES,
	type TransactionType,
	TransactionTypeIcon,
	useScreenSize,
} from "~/features/ledger";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
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
import {
	type Transaction,
	transactionsQueryOptions,
} from "../api/transactions.queries";
import {
	type ActivityPeriod,
	filterByPeriod,
	parseActivityPeriod,
} from "../lib/activity-filters";
import { ActivitySummary } from "./activity-summary";
import { TransactionSheet } from "./transaction-sheet";

// The columns that each window width hides. A phone keeps the type with the asset and the day, and the amount with the status.
// Under 80rem the side panel of a transaction still gives its account.
const HIDDEN_COLUMNS = {
	phone: ["asset", "date", "account", "quantity", "status"],
	medium: ["account"],
	wide: [],
} satisfies Record<ScreenSize, string[]>;

/** The list page. The period and the type tab filter the rows; then DataTable searches, sorts, and pages them. */
export function ActivityPage() {
	const { t, locale } = useT();
	const { data: transactions } = useSuspenseQuery(transactionsQueryOptions());
	const [period, setPeriod] = useState<ActivityPeriod>("all");
	const [type, setType] = useState<TransactionType | "all">("all");
	// The open transaction lives in the URL, so the home can link to it and the back button closes the panel.
	const { tx: openId } = useSearch({ from: "/app/activity" });
	const navigate = useNavigate();
	const screenSize = useScreenSize();
	const isPhone = screenSize === "phone";

	const number = new Intl.NumberFormat(locale);
	const money = moneyFormat(locale);
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	const dayCount = dayCountFormat(locale);
	const now = Date.now();
	const inPeriod = filterByPeriod(transactions, period, now);
	// A tab shows only for a type that has rows in the period. Each count equals the rows of its tab.
	const tabs = TRANSACTION_TYPES.map((value) => ({
		value,
		count: inPeriod.filter((row) => row.type === value).length,
	})).filter((tab) => tab.count > 0);
	// A shorter period can empty the chosen tab. Its tab then disappears, so the list shows all rows.
	const activeType = tabs.some((tab) => tab.value === type) ? type : "all";
	const rows =
		activeType === "all"
			? inPeriod
			: inPeriod.filter((row) => row.type === activeType);

	const allColumns: DataTableColumn<Transaction>[] = [
		{
			id: "type",
			header: t("activity.type"),
			sortValue: (row) => TRANSACTION_TYPES.indexOf(row.type),
			cell: (row) => (
				<button
					type="button"
					className="group flex items-center gap-3 text-start"
					aria-label={fillMessage(t("activity.open"), {
						reference: row.reference,
					})}
					onClick={() =>
						navigate({ to: "/app/activity", search: { tx: row.id } })
					}
				>
					<TransactionTypeIcon type={row.type} />
					<span className="grid">
						<span className="font-medium group-hover:underline">
							{t(`ledger.types.${row.type}`)}
						</span>
						<span className="text-muted-foreground text-xs tabular-nums">
							{isPhone
								? `${row.assetSymbol} · ${formatRelativeTime(row.occurredAt, now, locale)}`
								: row.reference}
						</span>
					</span>
				</button>
			),
		},
		{
			id: "asset",
			header: t("activity.asset"),
			sortValue: (row) => row.assetName,
			cell: (row) => (
				<Link
					to="/app/markets/$assetId"
					params={{ assetId: row.assetId }}
					className="group flex items-center gap-2"
				>
					<AssetGlyph symbol={row.assetSymbol} category={row.assetCategory} />
					<span className="font-medium group-hover:underline">
						{row.assetName}
					</span>
				</Link>
			),
		},
		{
			id: "date",
			header: t("activity.date"),
			sortValue: (row) => Date.parse(row.occurredAt),
			cell: (row) => (
				<span className="grid">
					<span>{date.format(new Date(row.occurredAt))}</span>
					<span className="text-muted-foreground text-xs">
						{formatRelativeTime(row.occurredAt, now, locale)}
					</span>
				</span>
			),
		},
		{
			id: "account",
			header: t("activity.account"),
			sortValue: (row) => ACCOUNTS.indexOf(row.account),
			cell: (row) => (
				<span className="text-muted-foreground">
					{t(`ledger.accounts.${row.account}`)}
				</span>
			),
		},
		{
			id: "quantity",
			header: t("activity.quantity"),
			align: "end",
			sortValue: (row) => row.quantity,
			cell: (row) => (
				<span className="grid justify-items-end">
					<span>{formatQuantity(row.quantity, locale)}</span>
					<span className="text-muted-foreground text-xs">
						{`@ ${formatPrice(row.unitPrice, locale)}`}
					</span>
				</span>
			),
		},
		{
			id: "amount",
			header: t("activity.amount"),
			align: "end",
			sortValue: (row) => row.amount,
			cell: (row) =>
				isPhone ? (
					<span className="grid justify-items-end gap-1">
						<span className="font-medium">{money.format(row.amount)}</span>
						<Badge variant={TRANSACTION_STATUS_BADGE[row.status]}>
							{t(`ledger.statuses.${row.status}`)}
						</Badge>
					</span>
				) : (
					<span className="font-medium">{money.format(row.amount)}</span>
				),
		},
		{
			id: "status",
			header: t("activity.status"),
			sortValue: (row) => TRANSACTION_STATUSES.indexOf(row.status),
			cell: (row) => (
				<Badge variant={TRANSACTION_STATUS_BADGE[row.status]}>
					{t(`ledger.statuses.${row.status}`)}
				</Badge>
			),
		},
	];

	const hiddenColumns: string[] = HIDDEN_COLUMNS[screenSize];
	const columns = allColumns.filter(
		(column) => !hiddenColumns.includes(column.id),
	);
	const onTypeChange = (value: string) =>
		setType(TRANSACTION_TYPES.find((option) => option === value) ?? "all");

	return (
		<div className="grid grid-cols-1 gap-6">
			<PageHeader
				title={t("activity.title")}
				description={t("activity.description")}
			/>
			<ActivitySummary transactions={rows} />
			<Card>
				<CardContent>
					<DataTable
						rows={rows}
						columns={columns}
						searchText={(row) =>
							`${row.assetName} ${row.assetSymbol} ${row.reference}`
						}
						noResults={t("activity.noResults")}
						toolbar={
							<>
								{/* The period comes before the types. When the row is short, the types wrap as one block. */}
								<Select
									value={String(period)}
									onValueChange={(value) =>
										setPeriod(parseActivityPeriod(value))
									}
								>
									<SelectTrigger
										aria-label={t("chart.period")}
										className="w-full max-sm:h-11 sm:w-40"
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent align="end">
										<SelectItem value="all">{t("activity.allTime")}</SelectItem>
										{PERIOD_DAYS.map((days) => (
											<SelectItem key={days} value={String(days)}>
												{fillMessage(t("activity.lastDays"), {
													days: dayCount.format(days),
												})}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								{/* A phone has no room for 6 tabs side by side, so it shows the same choice in a Select. */}
								{isPhone ? (
									<Select value={activeType} onValueChange={onTypeChange}>
										<SelectTrigger
											aria-label={t("activity.type")}
											className="h-11 w-full"
										>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="all">
												{`${t("activity.all")} (${number.format(inPeriod.length)})`}
											</SelectItem>
											{tabs.map((tab) => (
												<SelectItem key={tab.value} value={tab.value}>
													{`${t(`ledger.types.${tab.value}`)} (${number.format(tab.count)})`}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								) : (
									<Tabs
										value={activeType}
										onValueChange={onTypeChange}
										className="max-w-full overflow-x-auto"
									>
										<TabsList>
											<TabsTrigger value="all">
												{t("activity.all")}
												<span className="tabular-nums opacity-70">
													{number.format(inPeriod.length)}
												</span>
											</TabsTrigger>
											{tabs.map((tab) => (
												<TabsTrigger key={tab.value} value={tab.value}>
													{t(`ledger.types.${tab.value}`)}
													<span className="tabular-nums opacity-70">
														{number.format(tab.count)}
													</span>
												</TabsTrigger>
											))}
										</TabsList>
									</Tabs>
								)}
							</>
						}
					/>
				</CardContent>
			</Card>
			<TransactionSheet
				transaction={transactions.find((row) => row.id === openId) ?? null}
				onClose={() => navigate({ to: "/app/activity", search: {} })}
			/>
		</div>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

/** Placeholder while the list loader runs. The route sets it as pendingComponent. */
export function ActivityPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-4 w-80 max-w-full" />
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

/** Error state of the list when the loader fails. Try again runs the loader again. */
export function ActivityPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("activity.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
