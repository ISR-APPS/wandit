// The Holdings page, in the kit product list anatomy: a title row with an export, a row of 4 KPI cards,
// then the table of every position with a filter field, filter buttons, a column menu, row checkboxes, and row menus.
// The /app/holdings route renders it after its loader. The route also uses the skeleton and the error below.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { transactionsQueryOptions } from "~/features/activity";
import { PageHeader } from "~/features/app-shell";
import {
	ACCOUNTS,
	ASSET_CATEGORIES,
	AssetGlyph,
	ChangeText,
	copyToClipboard,
	downloadCsv,
	fillMessage,
	formatPrice,
	formatQuantity,
	moneyFormat,
	signedMoneyFormat,
	toCsv,
} from "~/features/ledger";
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
import { type Position, positionsQueryOptions } from "../api/positions.queries";
import { buildHoldingsFigures } from "../lib/holdings-figures";
import { positionCsvColumns } from "../lib/position-csv";
import { FigureCard } from "./figure-card";

// A list page shows 10 rows per page, like the kit product list.
const PAGE_SIZE = 10;
const KPI_GRID = "grid gap-4 @xl/main:grid-cols-2 @4xl/main:grid-cols-4";

/** The result of a position: a profit or a loss against its cost basis. The "Result" filter reads it. */
type PositionResult = "profit" | "loss";

/** The list page. The three filters narrow the rows; then RecordTable searches, sorts, and pages them. */
export function HoldingsPage() {
	const { t, locale } = useT();
	const { data: positions } = useSuspenseQuery(positionsQueryOptions());
	const { data: transactions } = useSuspenseQuery(transactionsQueryOptions());
	const [account, setAccount] = useState<string | null>(null);
	const [category, setCategory] = useState<string | null>(null);
	const [result, setResult] = useState<string | null>(null);

	const money = moneyFormat(locale);
	const signedMoney = signedMoneyFormat(locale);
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		signDisplay: "exceptZero",
		maximumFractionDigits: 1,
	});
	const figures = buildHoldingsFigures(positions, transactions, Date.now());
	const resultOf = (row: Position): PositionResult =>
		row.profit >= 0 ? "profit" : "loss";
	const rows = positions.filter(
		(row) =>
			(account === null || row.account === account) &&
			(category === null || row.category === category) &&
			(result === null || resultOf(row) === result),
	);
	// A filter button lists only the values that a position has.
	const accountOptions = ACCOUNTS.filter((value) =>
		positions.some((row) => row.account === value),
	).map((value) => ({ value, label: t(`ledger.accounts.${value}`) }));
	const categoryOptions = ASSET_CATEGORIES.filter((value) =>
		positions.some((row) => row.category === value),
	).map((value) => ({ value, label: t(`ledger.categories.${value}`) }));

	const columns: RecordColumn<Position>[] = [
		{
			id: "asset",
			header: t("holdings.asset"),
			sortValue: (row) => row.name,
			cell: (row) => (
				<Link
					to="/app/markets/$assetId"
					params={{ assetId: row.id }}
					className="flex items-center gap-4 hover:underline"
				>
					<AssetGlyph
						symbol={row.symbol}
						category={row.category}
						size="lg"
						shape="square"
					/>
					<span className="font-medium">{row.name}</span>
				</Link>
			),
		},
		{
			id: "price",
			header: t("holdings.price"),
			sortValue: (row) => row.price,
			cell: (row) => (
				<span className="tabular-nums">{formatPrice(row.price, locale)}</span>
			),
		},
		{
			id: "category",
			header: t("holdings.category"),
			hideable: true,
			sortValue: (row) => t(`ledger.categories.${row.category}`),
			cell: (row) => t(`ledger.categories.${row.category}`),
		},
		{
			id: "quantity",
			header: t("holdings.quantity"),
			hideable: true,
			sortValue: (row) => row.quantity,
			cell: (row) => (
				<span className="tabular-nums">
					{formatQuantity(row.quantity, locale)}
				</span>
			),
		},
		{
			id: "value",
			header: t("holdings.value"),
			hideable: true,
			sortValue: (row) => row.value,
			cell: (row) => (
				<span className="tabular-nums">{money.format(row.value)}</span>
			),
		},
		{
			id: "change24h",
			header: t("holdings.change24h"),
			hideable: true,
			sortValue: (row) => row.change24h,
			cell: (row) => <ChangeText change={row.change24h} />,
		},
		{
			id: "result",
			header: t("holdings.result"),
			sortValue: (row) => row.profitRatio ?? 0,
			cell: (row) => (
				<Badge
					variant={resultOf(row) === "profit" ? "success" : "outline"}
					// A loss takes the soft red of a destructive text: the base has no soft red badge.
					className={
						resultOf(row) === "loss"
							? "border-destructive/25 bg-destructive/12 text-destructive"
							: undefined
					}
				>
					<bdi dir="ltr">
						{row.profitRatio === null
							? signedMoney.format(row.profit)
							: percent.format(row.profitRatio)}
					</bdi>
				</Badge>
			),
		},
	];

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("holdings.title")}
				actions={
					<Button
						type="button"
						onClick={() =>
							downloadCsv("holdings.csv", toCsv(rows, positionCsvColumns(t)))
						}
					>
						<DownloadSimpleIcon />
						{t("common.exportCsv")}
					</Button>
				}
			/>
			<div className={KPI_GRID}>
				<FigureCard
					label={t("holdings.valueLabel")}
					value={money.format(figures.value.amount)}
					change={figures.value.change}
				/>
				<FigureCard
					label={t("holdings.profitLabel")}
					value={signedMoney.format(figures.profit.amount)}
					change={figures.profit.change}
				/>
				<FigureCard
					label={t("holdings.rewardsLabel")}
					value={money.format(figures.rewards.amount)}
					change={figures.rewards.change}
				/>
				<FigureCard
					label={t("holdings.feesLabel")}
					value={money.format(figures.fees.amount)}
					change={figures.fees.change}
					goodWhen="down"
				/>
			</div>
			<div className="pt-4">
				<RecordTable
					rows={rows}
					columns={columns}
					searchText={(row) => `${row.name} ${row.symbol}`}
					searchPlaceholder={t("holdings.search")}
					toolbar={
						<>
							<RecordFilter
								label={t("holdings.account")}
								options={accountOptions}
								value={account}
								onValueChange={setAccount}
							/>
							<RecordFilter
								label={t("holdings.category")}
								options={categoryOptions}
								value={category}
								onValueChange={setCategory}
							/>
							<RecordFilter
								label={t("holdings.result")}
								options={[
									{ value: "profit", label: t("holdings.results.profit") },
									{ value: "loss", label: t("holdings.results.loss") },
								]}
								value={result}
								onValueChange={setResult}
							/>
						</>
					}
					selectable
					bulkActions={(selected) => (
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="h-9"
							onClick={() =>
								downloadCsv(
									"holdings-selected.csv",
									toCsv(selected, positionCsvColumns(t)),
								)
							}
						>
							<DownloadSimpleIcon />
							{t("table.exportSelected")}
						</Button>
					)}
					rowMenu={(row) => (
						<>
							<DropdownMenuItem asChild>
								<Link to="/app/markets/$assetId" params={{ assetId: row.id }}>
									{fillMessage(t("holdings.open"), { name: row.name })}
								</Link>
							</DropdownMenuItem>
							<DropdownMenuItem
								onSelect={() =>
									copyToClipboard(row.symbol, {
										done: t("table.copied"),
										failed: t("table.copyFailed"),
									})
								}
							>
								{t("holdings.copySymbol")}
							</DropdownMenuItem>
						</>
					)}
					pageSize={PAGE_SIZE}
					noResults={t("holdings.noResults")}
				/>
			</div>
		</div>
	);
}

/** Placeholder while the holdings load. It draws the KPI row and the table with their sizes. */
export function HoldingsPageSkeleton() {
	return (
		<div className="grid gap-4">
			<Skeleton className="h-8 w-40" />
			<div className={KPI_GRID}>
				<Skeleton className="h-28" />
				<Skeleton className="h-28" />
				<Skeleton className="h-28" />
				<Skeleton className="h-28" />
			</div>
			<Skeleton className="mt-4 h-160" />
		</div>
	);
}

/** Error state of the page when the position query fails. Try again runs the loader again. */
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
