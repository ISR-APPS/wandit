// The Holdings page behind login: the totals strip, the account tabs, and the table of every position.
// The /app/holdings route renders it after its loader. The route also uses the skeleton and the error below.
// A row opens the page of its asset. The account tab filters the rows before the table and the totals get them.
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	ACCOUNTS,
	type Account,
	AssetGlyph,
	ChangeText,
	formatPrice,
	formatQuantity,
	moneyFormat,
	type ScreenSize,
	shareFormat,
	signedMoneyFormat,
	useScreenSize,
} from "~/features/ledger";
import { useT } from "~/shared/i18n";
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
import { type Position, positionsQueryOptions } from "../api/positions.queries";
import { HoldingsSummary } from "./holdings-summary";

// The columns that each window width hides. A phone keeps the asset with its units, and the value with its profit.
// Under 80rem the account tabs and the asset page still give the account and the average cost.
const HIDDEN_COLUMNS = {
	phone: ["account", "quantity", "averageCost", "price", "profit", "share"],
	medium: ["account", "averageCost"],
	wide: [],
} satisfies Record<ScreenSize, string[]>;

/** The list page. The account tab filters the rows; then DataTable searches, sorts, and pages them. */
export function HoldingsPage() {
	const { t, locale } = useT();
	const { data: positions } = useSuspenseQuery(positionsQueryOptions());
	const [account, setAccount] = useState<Account | "all">("all");
	const screenSize = useScreenSize();

	const number = new Intl.NumberFormat(locale);
	const money = moneyFormat(locale);
	const signedMoney = signedMoneyFormat(locale);
	const share = shareFormat(locale);
	// A tab shows only for an account that holds an asset.
	const tabs = ACCOUNTS.map((value) => ({
		value,
		count: positions.filter((row) => row.account === value).length,
	})).filter((tab) => tab.count > 0);
	const rows =
		account === "all"
			? positions
			: positions.filter((row) => row.account === account);

	const allColumns: DataTableColumn<Position>[] = [
		{
			id: "asset",
			header: t("holdings.asset"),
			sortValue: (row) => row.name,
			cell: (row) => (
				<Link
					to="/app/markets/$assetId"
					params={{ assetId: row.id }}
					className="group flex items-center gap-3"
				>
					<AssetGlyph symbol={row.symbol} category={row.category} />
					<span className="grid">
						<span className="font-medium group-hover:underline">
							{row.name}
						</span>
						<span className="text-muted-foreground text-xs tabular-nums">
							{screenSize === "phone"
								? `${formatQuantity(row.quantity, locale)} ${row.symbol}`
								: row.symbol}
						</span>
					</span>
				</Link>
			),
		},
		{
			id: "account",
			header: t("holdings.account"),
			sortValue: (row) => ACCOUNTS.indexOf(row.account),
			cell: (row) => (
				<span className="text-muted-foreground">
					{t(`ledger.accounts.${row.account}`)}
				</span>
			),
		},
		{
			id: "quantity",
			header: t("holdings.quantity"),
			align: "end",
			sortValue: (row) => row.quantity,
			cell: (row) => formatQuantity(row.quantity, locale),
		},
		{
			id: "averageCost",
			header: t("holdings.averageCost"),
			align: "end",
			sortValue: (row) => row.averageCost,
			cell: (row) => formatPrice(row.averageCost, locale),
		},
		{
			id: "price",
			header: t("holdings.price"),
			align: "end",
			sortValue: (row) => row.price,
			cell: (row) => (
				<span className="grid justify-items-end">
					<span>{formatPrice(row.price, locale)}</span>
					<ChangeText change={row.change24h} className="text-xs" />
				</span>
			),
		},
		{
			id: "value",
			header: t("holdings.value"),
			align: "end",
			sortValue: (row) => row.value,
			cell: (row) => (
				<span className="grid justify-items-end">
					<span className="font-medium">{money.format(row.value)}</span>
					{screenSize === "phone" && row.profitRatio !== null ? (
						<ChangeText change={row.profitRatio} className="text-xs" />
					) : null}
				</span>
			),
		},
		{
			id: "profit",
			header: t("holdings.profit"),
			align: "end",
			sortValue: (row) => row.profit,
			cell: (row) => (
				<span className="grid justify-items-end">
					{/* dir="ltr" keeps the sign in front of the amount in an Arabic page. */}
					<bdi dir="ltr">{signedMoney.format(row.profit)}</bdi>
					{row.profitRatio === null ? null : (
						<ChangeText change={row.profitRatio} className="text-xs" />
					)}
				</span>
			),
		},
		{
			id: "share",
			header: t("holdings.share"),
			align: "end",
			sortValue: (row) => row.share,
			cell: (row) => (
				<span className="flex items-center justify-end gap-2">
					<span
						aria-hidden="true"
						className="@3xl/main:block hidden h-1.5 w-16 overflow-hidden rounded-sm bg-muted"
					>
						<span
							className="block h-full rounded-sm bg-chart-1"
							style={{ width: `${row.share * 100}%` }}
						/>
					</span>
					<span className="w-12">{share.format(row.share)}</span>
				</span>
			),
		},
	];

	const hiddenColumns: string[] = HIDDEN_COLUMNS[screenSize];
	const columns = allColumns.filter(
		(column) => !hiddenColumns.includes(column.id),
	);
	const onAccountChange = (value: string) =>
		setAccount(ACCOUNTS.find((option) => option === value) ?? "all");

	return (
		<div className="grid grid-cols-1 gap-6">
			<PageHeader
				title={t("holdings.title")}
				description={t("holdings.description")}
			/>
			<HoldingsSummary positions={rows} allPositions={positions} />
			<Card>
				<CardContent>
					<DataTable
						rows={rows}
						columns={columns}
						searchText={(row) => `${row.name} ${row.symbol}`}
						noResults={t("holdings.noResults")}
						toolbar={
							// A phone has no room for 4 tabs side by side, so it shows the same choice in a Select.
							screenSize === "phone" ? (
								<Select value={account} onValueChange={onAccountChange}>
									<SelectTrigger
										aria-label={t("holdings.account")}
										className="h-11 w-full"
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">
											{`${t("holdings.allAccounts")} (${number.format(positions.length)})`}
										</SelectItem>
										{tabs.map((tab) => (
											<SelectItem key={tab.value} value={tab.value}>
												{`${t(`ledger.accounts.${tab.value}`)} (${number.format(tab.count)})`}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							) : (
								<Tabs
									value={account}
									onValueChange={onAccountChange}
									className="max-w-full overflow-x-auto"
								>
									<TabsList>
										<TabsTrigger value="all">
											{t("holdings.allAccounts")}
											<span className="tabular-nums opacity-70">
												{number.format(positions.length)}
											</span>
										</TabsTrigger>
										{tabs.map((tab) => (
											<TabsTrigger key={tab.value} value={tab.value}>
												{t(`ledger.accounts.${tab.value}`)}
												<span className="tabular-nums opacity-70">
													{number.format(tab.count)}
												</span>
											</TabsTrigger>
										))}
									</TabsList>
								</Tabs>
							)
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
export function HoldingsPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-4 w-80 max-w-full" />
			</div>
			<Skeleton className="h-24 w-full" />
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
export function HoldingsPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("holdings.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
