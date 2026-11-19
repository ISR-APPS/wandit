// The page of one asset, in the kit profile anatomy: a title row with a link back to Markets, then Overview and Transactions tabs.
// Overview: the price chart band, then a 1/3 column (profile card, portfolio share, about) and a 2/3 column
// (key moments, then the transaction history and similar assets side by side). Transactions: every transaction of the asset.
// The /app/markets/$assetId route renders it after its loader. An unknown id shows a not-found card.
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { assetTransactionsQueryOptions } from "~/features/activity";
import { PageHeader } from "~/features/app-shell";
import { assetPositionQueryOptions } from "~/features/holdings";
import { useT } from "~/shared/i18n";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { assetQueryOptions, assetsQueryOptions } from "../api/assets.queries";
import { AboutCard } from "./about-card";
import { AssetProfileCard } from "./asset-profile-card";
import { AssetTradesTable } from "./asset-trades-table";
import { AssetTransactionsCard } from "./asset-transactions-card";
import { KeyMomentsCard } from "./key-moments-card";
import { PositionShareCard } from "./position-share-card";
import { PriceChartCard } from "./price-chart-card";
import { SimilarAssetsCard } from "./similar-assets-card";

type AssetDetailPageProps = {
	/** The `$assetId` param of the URL. The query answers null for an id that does not exist. */
	assetId: string;
};

/** The detail page. The tab is state: the route gives each asset a new key, so it starts on Overview. */
export function AssetDetailPage({ assetId }: AssetDetailPageProps) {
	const { t } = useT();
	const { data: asset } = useSuspenseQuery(assetQueryOptions(assetId));
	const { data: assets } = useSuspenseQuery(assetsQueryOptions());
	const { data: position } = useSuspenseQuery(
		assetPositionQueryOptions(assetId),
	);
	const { data: transactions } = useSuspenseQuery(
		assetTransactionsQueryOptions(assetId),
	);
	const [tab, setTab] = useState("overview");

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
		<div className="grid gap-4">
			<PageHeader
				title={asset.name}
				actions={
					<Button asChild>
						<Link to="/app/markets">
							<CaretLeftIcon className="rtl:rotate-180" />
							{t("markets.title")}
						</Link>
					</Button>
				}
			/>
			<Tabs value={tab} onValueChange={setTab} className="gap-4">
				<TabsList>
					<TabsTrigger value="overview">{t("asset.overviewTab")}</TabsTrigger>
					<TabsTrigger value="transactions">
						{t("asset.transactionsTab")}
					</TabsTrigger>
				</TabsList>
				<TabsContent value="overview" className="grid gap-4">
					{/* The price chart is a full band above the profile grid, so the two columns of the grid keep equal heights. */}
					<PriceChartCard asset={asset} />
					<div className="grid @4xl/main:grid-cols-3 items-start gap-4">
						<div className="grid gap-4">
							<AssetProfileCard asset={asset} />
							<PositionShareCard symbol={asset.symbol} position={position} />
							<AboutCard asset={asset} position={position} />
						</div>
						<div className="@4xl/main:col-span-2 grid gap-4">
							<KeyMomentsCard symbol={asset.symbol} moments={asset.moments} />
							<div className="grid @4xl/main:grid-cols-2 gap-4">
								<AssetTransactionsCard
									symbol={asset.symbol}
									transactions={transactions}
								/>
								<SimilarAssetsCard assetId={asset.id} assets={assets} />
							</div>
						</div>
					</div>
				</TabsContent>
				<TabsContent value="transactions">
					<Card>
						<CardHeader>
							<CardTitle>{t("asset.transactionsTitle")}</CardTitle>
						</CardHeader>
						<CardContent>
							<AssetTradesTable transactions={transactions} />
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}

/** Placeholder while the detail loader runs. The route sets it as pendingComponent. */
export function AssetDetailPageSkeleton() {
	return (
		<div className="grid gap-4">
			<Skeleton className="h-8 w-48" />
			<Skeleton className="h-9 w-56" />
			<div className="grid @4xl/main:grid-cols-3 items-start gap-4">
				<Skeleton className="h-144" />
				<Skeleton className="@4xl/main:col-span-2 h-144" />
			</div>
		</div>
	);
}
