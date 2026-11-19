// The similar assets card of the asset page: 5 assets of the same category, then the nearest by rank,
// each with its glyph, its name, its ticker and price, and an "Open" link. The header button opens Markets.
// AssetDetailPage renders it in the 2-card row of the Overview tab.
import { Link } from "@tanstack/react-router";
import { AssetGlyph, formatPrice } from "~/features/ledger";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { CaretRightIcon } from "~/shared/ui/icons";
import type { Asset } from "../api/assets.queries";

// 5 rows keep the card as high as the transaction history card beside it.
const SHOWN_ASSETS = 5;

type SimilarAssetsCardProps = {
	/** The asset of the page. The card leaves it out of the list. */
	assetId: string;
	/** Every asset of the market list, from assetsQueryOptions. */
	assets: Asset[];
};

/** The same category comes first. The rest of the list is the assets nearest in rank. */
export function SimilarAssetsCard({ assetId, assets }: SimilarAssetsCardProps) {
	const { t, locale } = useT();
	const current = assets.find((asset) => asset.id === assetId);
	const others = assets.filter((asset) => asset.id !== assetId);
	const rankOf = current?.rank ?? 0;
	const similar = [...others]
		.sort(
			(first, second) =>
				Number(second.category === current?.category) -
					Number(first.category === current?.category) ||
				Math.abs(first.rank - rankOf) - Math.abs(second.rank - rankOf),
		)
		.slice(0, SHOWN_ASSETS);

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("asset.similarTitle")}</CardTitle>
				<CardAction>
					<Button variant="outline" size="icon" asChild>
						<Link to="/app/markets" aria-label={t("asset.backToMarkets")}>
							<CaretRightIcon className="rtl:rotate-180" />
						</Link>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent>
				<ul className="grid gap-6">
					{similar.map((asset) => (
						<li key={asset.id} className="flex items-center gap-3">
							<AssetGlyph symbol={asset.symbol} category={asset.category} />
							<div className="grid min-w-0 flex-1 gap-0.5">
								<p className="truncate font-medium text-sm">{asset.name}</p>
								<p className="truncate text-muted-foreground text-xs tabular-nums">
									{`${asset.symbol} · ${formatPrice(asset.price, locale)}`}
								</p>
							</div>
							<Button
								variant={asset.isHeld ? "default" : "outline"}
								size="sm"
								asChild
							>
								<Link to="/app/markets/$assetId" params={{ assetId: asset.id }}>
									{asset.isHeld ? t("asset.openHeld") : t("asset.open")}
								</Link>
							</Button>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
