// The ranked tile of the home: the 5 largest positions by value, each with a bar against the largest one.
// PortfolioPage renders it with the position list. A row opens the page of its asset.
import { Link } from "@tanstack/react-router";
import type { Position } from "~/features/holdings";
import { AssetGlyph, moneyFormat, shareFormat } from "~/features/ledger";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";

// The tile ranks this many positions. The Holdings page lists all of them.
const TOP_COUNT = 5;

type TopHoldingsTileProps = {
	/** Every position, largest value first, from positionsQueryOptions(). */
	positions: Position[];
	/** The grid span of the tile in the mosaic. */
	className?: string;
};

/** With no position, the tile shows one sentence. */
export function TopHoldingsTile({
	positions,
	className,
}: TopHoldingsTileProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const share = shareFormat(locale);
	const top = positions.slice(0, TOP_COUNT);
	const largest = top[0]?.value ?? 0;

	return (
		<Card className={className}>
			<CardHeader>
				<CardTitle>{t("portfolio.topTitle")}</CardTitle>
				<CardDescription>{t("portfolio.topDescription")}</CardDescription>
				<CardAction>
					<Button
						asChild
						variant="ghost"
						size="sm"
						// A touch target of 44 px on a phone.
						className="-me-2 max-sm:h-11"
					>
						<Link to="/app/holdings">{t("common.viewAll")}</Link>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent>
				{top.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("portfolio.topEmpty")}
					</p>
				) : (
					<ul className="-mx-2 grid gap-1">
						{top.map((position) => (
							<li key={position.id}>
								<Link
									to="/app/markets/$assetId"
									params={{ assetId: position.id }}
									className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/60"
								>
									<AssetGlyph
										symbol={position.symbol}
										category={position.category}
									/>
									<span className="grid min-w-0 flex-1 gap-1.5">
										<span className="flex items-baseline justify-between gap-2 text-sm">
											<span className="truncate font-medium">
												{position.name}
											</span>
											<span className="font-medium tabular-nums">
												{money.format(position.value)}
											</span>
										</span>
										<span className="flex items-center gap-2">
											<span
												aria-hidden="true"
												className="h-1.5 flex-1 overflow-hidden rounded-sm bg-muted"
											>
												<span
													className="block h-full rounded-sm bg-chart-1"
													style={{
														width: `${largest === 0 ? 0 : (position.value / largest) * 100}%`,
													}}
												/>
											</span>
											<span className="w-11 text-end text-muted-foreground text-xs tabular-nums">
												{share.format(position.share)}
											</span>
										</span>
									</span>
								</Link>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
