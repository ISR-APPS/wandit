// The top holdings card of the home: the 3 largest positions as boxed links, each with its units and its value.
// PortfolioPage renders it second in band 1. Each box opens the asset page; the header button opens Holdings.
import { Link } from "@tanstack/react-router";
import type { Position } from "~/features/holdings";
import { AssetGlyph, formatQuantity, moneyFormat } from "~/features/ledger";
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

// The card has the height of the overview card beside it: 3 boxes fill it.
const SHOWN_POSITIONS = 3;

type TopHoldingsCardProps = {
	/** Every position, the largest value first, as positionsQueryOptions returns them. */
	positions: Position[];
};

/** No position shows one muted sentence. */
export function TopHoldingsCard({ positions }: TopHoldingsCardProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("portfolio.topTitle")}</CardTitle>
				<CardAction>
					<Button variant="outline" size="icon" asChild>
						<Link to="/app/holdings" aria-label={t("portfolio.topAll")}>
							<CaretRightIcon className="rtl:rotate-180" />
						</Link>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent className="grid gap-4">
				{positions.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("portfolio.topEmpty")}
					</p>
				) : (
					positions.slice(0, SHOWN_POSITIONS).map((position) => (
						<Link
							key={position.id}
							to="/app/markets/$assetId"
							params={{ assetId: position.id }}
							className="grid gap-2 rounded-md border p-3 transition-colors hover:border-primary/40 hover:bg-muted/60"
						>
							<span className="flex min-w-0 items-center gap-2">
								<AssetGlyph
									symbol={position.symbol}
									category={position.category}
								/>
								<span className="truncate">{position.name}</span>
							</span>
							<span className="flex items-baseline justify-between gap-3 tabular-nums">
								<span>{`${formatQuantity(position.quantity, locale)} ${position.symbol}`}</span>
								<span className="text-muted-foreground text-sm">
									{money.format(position.value)}
								</span>
							</span>
						</Link>
					))
				)}
			</CardContent>
		</Card>
	);
}
