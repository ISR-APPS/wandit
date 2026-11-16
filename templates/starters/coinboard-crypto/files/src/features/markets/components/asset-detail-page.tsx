// The page of one asset: its price chart, a text about it, the transactions of the user,
// and a rail with the position, the market stats, and the key moments of the year.
// The /app/markets/$assetId route renders it after its loader. The route also uses the skeleton below.
// An unknown id shows a not-found card with a link back to the list.
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { assetTransactionsQueryOptions } from "~/features/activity";
import { PageHeader } from "~/features/app-shell";
import { assetPositionQueryOptions } from "~/features/holdings";
import { AssetGlyph, fillMessage } from "~/features/ledger";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { CaretLeftIcon } from "~/shared/ui/icons";
import { Skeleton } from "~/shared/ui/skeleton";
import { assetQueryOptions } from "../api/assets.queries";
import { AssetTransactionsCard } from "./asset-transactions-card";
import { KeyMomentsCard } from "./key-moments-card";
import { MarketStatsCard } from "./market-stats-card";
import { PositionCard } from "./position-card";
import { PriceChartCard } from "./price-chart-card";

type AssetDetailPageProps = {
	/** The `$assetId` param of the URL. The query answers null for an id that does not exist. */
	assetId: string;
};

/** The detail page. A 2/3 main column and a 1/3 rail from the 4xl container width. */
export function AssetDetailPage({ assetId }: AssetDetailPageProps) {
	const { t, locale } = useT();
	const { data: asset } = useSuspenseQuery(assetQueryOptions(assetId));
	const { data: position } = useSuspenseQuery(
		assetPositionQueryOptions(assetId),
	);
	const { data: transactions } = useSuspenseQuery(
		assetTransactionsQueryOptions(assetId),
	);

	const backLink = (
		<Button
			asChild
			variant="ghost"
			size="sm"
			className="-ms-3 justify-self-start"
		>
			<Link to="/app/markets">
				<CaretLeftIcon className="rtl:rotate-180" />
				{t("markets.title")}
			</Link>
		</Button>
	);
	if (!asset) {
		return (
			<Card className="max-w-md">
				<CardHeader>
					<CardTitle>{t("asset.notFoundTitle")}</CardTitle>
					<CardDescription>{t("asset.notFound")}</CardDescription>
				</CardHeader>
				<CardFooter>
					<Button asChild variant="outline">
						<Link to="/app/markets">{t("asset.backToMarkets")}</Link>
					</Button>
				</CardFooter>
			</Card>
		);
	}

	return (
		<div className="grid grid-cols-1 gap-6">
			{backLink}
			<div className="flex items-center gap-4">
				<AssetGlyph symbol={asset.symbol} category={asset.category} size="lg" />
				<PageHeader
					title={asset.name}
					description={
						<span className="flex flex-wrap items-center gap-2">
							<span className="font-medium text-foreground">
								{asset.symbol}
							</span>
							<Badge variant="secondary">
								{t(`ledger.categories.${asset.category}`)}
							</Badge>
							<span>
								{fillMessage(t("asset.rank"), {
									rank: new Intl.NumberFormat(locale).format(asset.rank),
								})}
							</span>
							{asset.isHeld ? (
								<Badge variant="outline">{t("markets.held")}</Badge>
							) : null}
						</span>
					}
				/>
			</div>
			{/* One grid in the order of a phone: price, rail, about, transactions. So the position comes right after the price.
			    From 4xl the rail moves to the third column, beside the three main cards. The last row takes the free height. */}
			<div className="grid @4xl/main:grid-cols-3 grid-cols-1 @4xl/main:grid-rows-[auto_auto_1fr] items-start gap-6">
				<div className="@4xl/main:col-span-2 grid">
					<PriceChartCard asset={asset} />
				</div>
				{/* The rail: one column beside the main column, two columns when it sits under the price on a tablet. */}
				<div className="@4xl/main:col-start-3 @4xl/main:row-span-3 @4xl/main:row-start-1 grid @2xl/main:grid-cols-2 @4xl/main:grid-cols-1 grid-cols-1 items-start gap-6">
					<PositionCard symbol={asset.symbol} position={position} />
					<MarketStatsCard asset={asset} />
					<KeyMomentsCard symbol={asset.symbol} moments={asset.moments} />
				</div>
				<Card className="@4xl/main:col-span-2">
					<CardHeader>
						<CardTitle>
							{fillMessage(t("asset.aboutTitle"), { name: asset.name })}
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="max-w-prose text-muted-foreground text-sm leading-relaxed">
							{asset.about}
						</p>
					</CardContent>
				</Card>
				<div className="@4xl/main:col-span-2 grid">
					<AssetTransactionsCard
						symbol={asset.symbol}
						transactions={transactions}
					/>
				</div>
			</div>
		</div>
	);
}

/** Placeholder while the detail loader runs. The route sets it as pendingComponent. */
export function AssetDetailPageSkeleton() {
	return (
		<div className="grid gap-6">
			<Skeleton className="h-8 w-28" />
			<div className="flex items-center gap-4">
				<Skeleton className="size-12 rounded-full" />
				<div className="grid gap-2">
					<Skeleton className="h-8 w-48" />
					<Skeleton className="h-5 w-64 max-w-full" />
				</div>
			</div>
			<div className="grid @4xl/main:grid-cols-3 grid-cols-1 items-start gap-6">
				<Skeleton className="@4xl/main:col-span-2 h-112" />
				<Skeleton className="h-80" />
			</div>
		</div>
	);
}
