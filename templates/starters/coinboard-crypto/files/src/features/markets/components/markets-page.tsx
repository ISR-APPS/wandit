// The Markets page behind login: the direction tabs, the category filter, and the table of every asset.
// The /app/markets route renders it after its loader. The route also uses the skeleton and the error below.
// The active tab lives in the URL (?move=), so the home can link to it. A row opens the page of its asset.
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
	type AssetCategory,
	AssetGlyph,
	ChangeText,
	FLAT_MOVE_RATIO,
	fillMessage,
	formatPrice,
	moneyFormat,
	PRICE_MOVES,
	type ScreenSize,
	signedPercentFormat,
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
import { type Asset, assetsQueryOptions } from "../api/assets.queries";
import { PriceSpark } from "./price-spark";

// The columns that each window width hides. A phone keeps the asset and the price, with the 24h change under the price.
// Under 80rem the mini chart still shows the 7 days, and it sorts by their change.
const HIDDEN_COLUMNS = {
	phone: ["rank", "change24h", "change7d", "marketSize", "volume", "spark"],
	medium: ["change7d", "volume"],
	wide: [],
} satisfies Record<ScreenSize, string[]>;

/** The list page. The category and the tab filter the rows; then DataTable searches, sorts, and pages them. */
export function MarketsPage() {
	const { t, locale } = useT();
	const navigate = useNavigate();
	const { data: assets } = useSuspenseQuery(assetsQueryOptions());
	const { move } = useSearch({ from: "/app/markets/" });
	const [category, setCategory] = useState<AssetCategory | "all">("all");
	const screenSize = useScreenSize();

	const number = new Intl.NumberFormat(locale);
	const compactMoney = moneyFormat(locale, "compact");
	const signedPercent = signedPercentFormat(locale);
	// The filter lists only the categories that have an asset.
	const categories = ASSET_CATEGORIES.filter((value) =>
		assets.some((asset) => asset.category === value),
	);
	const inCategory =
		category === "all"
			? assets
			: assets.filter((asset) => asset.category === category);
	// The tab counts follow the category filter, so each count equals the rows of its tab.
	const tabs = PRICE_MOVES.map((value) => ({
		value,
		count: inCategory.filter((asset) => asset.move === value).length,
	}));
	const rows = move
		? inCategory.filter((asset) => asset.move === move)
		: inCategory;

	const allColumns: DataTableColumn<Asset>[] = [
		{
			id: "rank",
			header: t("markets.rank"),
			sortValue: (row) => row.rank,
			cell: (row) => (
				<span className="text-muted-foreground tabular-nums">
					{number.format(row.rank)}
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
					className="group flex items-center gap-3"
				>
					<AssetGlyph symbol={row.symbol} category={row.category} />
					<span className="grid">
						<span className="font-medium group-hover:underline">
							{row.name}
						</span>
						<span className="text-muted-foreground text-xs">
							{row.symbol}
							{/* A phone shows the ticker only, so the price column stays in view. */}
							<span className="max-sm:hidden">
								{` · ${t(`ledger.categories.${row.category}`)}`}
							</span>
							{/* The held mark sits in the ticker line, so every name starts and ends at the same place. */}
							{row.isHeld ? (
								<>
									{" · "}
									<span className="font-medium text-primary">
										{t("markets.held")}
									</span>
								</>
							) : null}
						</span>
					</span>
				</Link>
			),
		},
		{
			id: "price",
			header: t("markets.price"),
			align: "end",
			sortValue: (row) => row.price,
			cell: (row) => (
				<span className="grid justify-items-end">
					<span className="font-medium">{formatPrice(row.price, locale)}</span>
					{screenSize === "phone" ? (
						<ChangeText
							change={row.change24h}
							flatBelow={FLAT_MOVE_RATIO}
							className="text-xs"
						/>
					) : null}
				</span>
			),
		},
		{
			id: "change24h",
			header: t("markets.change24h"),
			align: "end",
			sortValue: (row) => row.change24h,
			// The "Flat" tab holds a move under FLAT_MOVE_RATIO, so such a move is not red or green here.
			cell: (row) => (
				<ChangeText change={row.change24h} flatBelow={FLAT_MOVE_RATIO} />
			),
		},
		{
			id: "change7d",
			header: t("markets.change7d"),
			align: "end",
			sortValue: (row) => row.change7d,
			cell: (row) => (
				<ChangeText change={row.change7d} flatBelow={FLAT_MOVE_RATIO} />
			),
		},
		{
			id: "marketSize",
			header: t("markets.marketSize"),
			align: "end",
			sortValue: (row) => row.marketSize,
			cell: (row) => compactMoney.format(row.marketSize),
		},
		{
			id: "volume",
			header: t("markets.volume"),
			align: "end",
			sortValue: (row) => row.volume24h,
			cell: (row) => compactMoney.format(row.volume24h),
		},
		{
			id: "spark",
			header: t("markets.last7Days"),
			align: "end",
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
	];

	const hiddenColumns: string[] = HIDDEN_COLUMNS[screenSize];
	const columns = allColumns.filter(
		(column) => !hiddenColumns.includes(column.id),
	);

	return (
		<div className="grid grid-cols-1 gap-6">
			<PageHeader
				title={t("markets.title")}
				description={fillMessage(t("markets.description"), {
					count: number.format(assets.length),
				})}
			/>
			<Card>
				<CardContent>
					<DataTable
						rows={rows}
						columns={columns}
						searchText={(row) => `${row.name} ${row.symbol}`}
						noResults={t("markets.noResults")}
						toolbar={
							<>
								{/* The Select comes before the tabs. When the row is short, the tabs wrap as one block. */}
								<Select
									value={category}
									onValueChange={(value) =>
										setCategory(
											ASSET_CATEGORIES.find((option) => option === value) ??
												"all",
										)
									}
								>
									<SelectTrigger
										aria-label={t("markets.category")}
										className="w-full max-sm:h-11 sm:w-44"
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent align="end">
										<SelectItem value="all">
											{t("markets.allCategories")}
										</SelectItem>
										{categories.map((value) => (
											<SelectItem key={value} value={value}>
												{t(`ledger.categories.${value}`)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<Tabs
									value={move ?? "all"}
									onValueChange={(value) =>
										navigate({
											to: "/app/markets",
											search: {
												move: PRICE_MOVES.find((option) => option === value),
											},
											replace: true,
										})
									}
									className="max-w-full overflow-x-auto"
								>
									{/* A touch target of 44 px on a phone. */}
									<TabsList className="max-sm:group-data-[orientation=horizontal]/tabs:h-11">
										<TabsTrigger value="all">
											{t("markets.all")}
											<span className="tabular-nums opacity-70">
												{number.format(inCategory.length)}
											</span>
										</TabsTrigger>
										{tabs.map((tab) => (
											<TabsTrigger key={tab.value} value={tab.value}>
												{t(`ledger.moves.${tab.value}`)}
												<span className="tabular-nums opacity-70">
													{number.format(tab.count)}
												</span>
											</TabsTrigger>
										))}
									</TabsList>
								</Tabs>
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
export function MarketsPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-4 w-80 max-w-full" />
			</div>
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
