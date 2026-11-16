// The status tile of the home: how many assets of the market list rise, stay flat, or fall over 24 hours.
// PortfolioPage renders it with the asset list. Each line opens the Markets page on that tab.
// Under the lines, it names the asset with the largest rise and the one with the largest fall.
import { Link } from "@tanstack/react-router";
import {
	ChangeText,
	fillMessage,
	PRICE_MOVE_BADGE,
	PRICE_MOVES,
	type PriceMove,
} from "~/features/ledger";
import type { Asset } from "~/features/markets";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";

/** The fill of the share bar of each direction. */
const MOVE_FILL = {
	rising: "bg-success",
	flat: "bg-muted-foreground",
	falling: "bg-destructive",
} satisfies Record<PriceMove, string>;

type MarketBreadthTileProps = {
	/** Every asset of the market list, from assetsQueryOptions(). */
	assets: Asset[];
	/** The grid span of the tile in the mosaic. */
	className?: string;
};

/** With no asset, each line shows 0 and an empty track. */
export function MarketBreadthTile({
	assets,
	className,
}: MarketBreadthTileProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	// LIMIT: counts the rows of the list query in the browser, at most 1,000 assets. Upgrade: a SQL count per direction.
	const counts = PRICE_MOVES.map((move) => ({
		move,
		count: assets.filter((asset) => asset.move === move).length,
	}));
	const byChange = [...assets].sort(
		(first, second) => second.change24h - first.change24h,
	);
	const movers = [
		{ labelKey: "portfolio.topGainer", asset: byChange[0] },
		{ labelKey: "portfolio.topLoser", asset: byChange.at(-1) },
	] as const;

	return (
		<Card className={className}>
			<CardHeader>
				<CardTitle>{t("portfolio.breadthTitle")}</CardTitle>
				<CardDescription>
					{fillMessage(t("portfolio.breadthDescription"), {
						count: number.format(assets.length),
					})}
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-1 flex-col gap-4">
				<ul className="-mx-2 grid gap-1">
					{counts.map(({ move, count }) => (
						<li key={move}>
							<Link
								to="/app/markets"
								search={{ move }}
								className="grid gap-1.5 rounded-md px-2 py-1.5 hover:bg-muted/60"
							>
								<span className="flex items-center justify-between gap-2">
									<Badge variant={PRICE_MOVE_BADGE[move]}>
										{t(`ledger.moves.${move}`)}
									</Badge>
									<span className="font-numeric font-semibold tabular-nums">
										{number.format(count)}
									</span>
								</span>
								<span
									aria-hidden="true"
									className="h-1.5 overflow-hidden rounded-sm bg-muted"
								>
									<span
										className={cn("block h-full rounded-sm", MOVE_FILL[move])}
										style={{
											width: `${assets.length === 0 ? 0 : (count / assets.length) * 100}%`,
										}}
									/>
								</span>
							</Link>
						</li>
					))}
				</ul>
				{assets.length < 2 ? null : (
					<dl className="mt-auto grid gap-2 border-t pt-4 text-sm">
						{movers.map(({ labelKey, asset }) =>
							asset ? (
								<div
									key={labelKey}
									className="flex items-center justify-between gap-2"
								>
									<dt className="text-muted-foreground">{t(labelKey)}</dt>
									<dd className="flex items-center gap-2">
										<Link
											to="/app/markets/$assetId"
											params={{ assetId: asset.id }}
											className="font-medium hover:underline"
										>
											{asset.symbol}
										</Link>
										<ChangeText change={asset.change24h} />
									</dd>
								</div>
							) : null,
						)}
					</dl>
				)}
			</CardContent>
		</Card>
	);
}
