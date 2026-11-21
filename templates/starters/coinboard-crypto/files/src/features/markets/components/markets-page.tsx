// The Markets page, in the kit order list anatomy: a title row with an export, the direction tabs,
// then the table of every asset with a filter field, filter buttons, a column menu, row checkboxes, and row menus.
// The /app/markets route renders it after its loader. The route also uses the skeleton and the error below.
// The active tab lives in the URL (?move=), so a link can open it. A row opens the page of its asset.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
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
	ASSET_CATEGORIES,
	AssetGlyph,
	ChangeText,
	copyToClipboard,
	downloadCsv,
	FLAT_MOVE_RATIO,
	fillMessage,
	formatPrice,
	moneyFormat,
	PRICE_MOVE_BADGE,
	PRICE_MOVES,
	signedPercentFormat,
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
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { type Asset, assetsQueryOptions } from "../api/assets.queries";
import { assetCsvColumns } from "../lib/asset-csv";
import { PriceSpark } from "./price-spark";

// A list page shows 10 rows per page, like the kit order list.
const PAGE_SIZE = 10;

/** The list page. The tab and the two filters narrow the rows; then RecordTable searches, sorts, and pages them. */
export function MarketsPage() {
	const { t, locale } = useT();
	const navigate = useNavigate();
	const { data: assets } = useSuspenseQuery(assetsQueryOptions());
	const { move } = useSearch({ from: "/app/markets/" });
	const [category, setCategory] = useState<string | null>(null);
	const [holding, setHolding] = useState<string | null>(null);

	const number = new Intl.NumberFormat(locale);
	const compactMoney = moneyFormat(locale, "compact");
	const signedPercent = signedPercentFormat(locale);
	const rows = assets.filter(
		(asset) =>
			(move === undefined || asset.move === move) &&
			(category === null || asset.category === category) &&
			(holding === null || (holding === "held") === asset.isHeld),
	);
	// The category filter lists only the categories that have an asset.
	const categoryOptions = ASSET_CATEGORIES.filter((value) =>
		assets.some((asset) => asset.category === value),
	).map((value) => ({ value, label: t(`ledger.categories.${value}`) }));

	const columns: RecordColumn<Asset>[] = [
		{
			id: "rank",
			header: t("markets.rank"),
			sortValue: (row) => row.rank,
			cell: (row) => (
				<span className="text-muted-foreground tabular-nums">
					{`#${number.format(row.rank)}`}
				</span>
			),
		},
		{
			id: "asset",
			header: t("markets.asset"),
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
			header: t("markets.price"),
			sortValue: (row) => row.price,
			cell: (row) => (
				<span className="tabular-nums">{formatPrice(row.price, locale)}</span>
			),
		},
		{
			id: "marketSize",
			header: t("markets.marketSize"),
			hideable: true,
			sortValue: (row) => row.marketSize,
			cell: (row) => (
				<span className="grid gap-0.5 tabular-nums">
					<span className="font-medium">
						{compactMoney.format(row.marketSize)}
					</span>
					<span className="text-muted-foreground text-xs">
						{fillMessage(t("markets.volumeLine"), {
							volume: compactMoney.format(row.volume24h),
						})}
					</span>
				</span>
			),
		},
		{
			id: "change24h",
			header: t("markets.change24h"),
			hideable: true,
			sortValue: (row) => row.change24h,
			cell: (row) => (
				<ChangeText change={row.change24h} flatBelow={FLAT_MOVE_RATIO} />
			),
		},
		{
			id: "spark",
			header: t("markets.last7Days"),
			hideable: true,
			// The spark has no single value, so the column sorts by the 7-day change that the spark draws.
			sortValue: (row) => row.change7d,
			cell: (row) => (
				<PriceSpark
					prices={row.spark}
					label={fillMessage(t("markets.sparkLabel"), {
						symbol: row.symbol,
						change: signedPercent.format(row.change7d),
					})}
				/>
			),
		},
		{
			id: "move",
			header: t("markets.trend"),
			sortValue: (row) => PRICE_MOVES.indexOf(row.move),
			cell: (row) => (
				<Badge variant={PRICE_MOVE_BADGE[row.move]}>
					{t(`ledger.moves.${row.move}`)}
				</Badge>
			),
		},
	];

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("markets.title")}
				actions={
					<Button
						type="button"
						onClick={() =>
							downloadCsv("markets.csv", toCsv(rows, assetCsvColumns(t)))
						}
					>
						<DownloadSimpleIcon />
						{t("common.exportCsv")}
					</Button>
				}
			/>
			<Tabs
				value={move ?? "all"}
				onValueChange={(value) =>
					navigate({
						to: "/app/markets",
						search: { move: PRICE_MOVES.find((option) => option === value) },
						replace: true,
					})
				}
				className="max-w-full overflow-x-auto"
			>
				<TabsList aria-label={t("markets.trend")}>
					<TabsTrigger value="all">{t("markets.all")}</TabsTrigger>
					{PRICE_MOVES.map((value) => (
						<TabsTrigger key={value} value={value}>
							{t(`ledger.moves.${value}`)}
						</TabsTrigger>
					))}
				</TabsList>
			</Tabs>
			<RecordTable
				rows={rows}
				columns={columns}
				searchText={(row) => `${row.name} ${row.symbol}`}
				searchPlaceholder={t("markets.search")}
				toolbar={
					<>
						<RecordFilter
							label={t("markets.category")}
							options={categoryOptions}
							value={category}
							onValueChange={setCategory}
						/>
						<RecordFilter
							label={t("markets.holding")}
							options={[
								{ value: "held", label: t("markets.held") },
								{ value: "notHeld", label: t("markets.notHeld") },
							]}
							value={holding}
							onValueChange={setHolding}
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
								"markets-selected.csv",
								toCsv(selected, assetCsvColumns(t)),
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
								{fillMessage(t("markets.open"), { name: row.name })}
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
							{t("markets.copySymbol")}
						</DropdownMenuItem>
					</>
				)}
				pageSize={PAGE_SIZE}
				noResults={t("markets.noResults")}
			/>
		</div>
	);
}

/** Placeholder while the list loader runs. The route sets it as pendingComponent. */
export function MarketsPageSkeleton() {
	return (
		<div className="grid gap-4">
			<Skeleton className="h-8 w-40" />
			<Skeleton className="h-9 w-80 max-w-full" />
			<Skeleton className="h-160" />
		</div>
	);
}

/** Error state of the list and of the asset page when a loader fails. Try again runs the loader again. */
export function MarketsPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("markets.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
