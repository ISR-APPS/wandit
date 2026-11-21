// The profile card of the asset page: the large glyph, the name with its ticker, the category,
// a strip of 3 figures (price, 24h change, rank), and a list of market facts with icons.
// AssetDetailPage renders it first in the start column of the Overview tab.
import {
	ArrowsLeftRightIcon,
	ChartPieSliceIcon,
	CoinsIcon,
	TrendDownIcon,
	TrendUpIcon,
} from "@phosphor-icons/react";
import {
	AssetGlyph,
	ChangeText,
	FLAT_MOVE_RATIO,
	formatPrice,
	moneyFormat,
} from "~/features/ledger";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Card, CardContent } from "~/shared/ui/card";
import type { KitIcon } from "~/shared/ui/icons";
import type { AssetDetail } from "../api/assets.queries";

type AssetProfileCardProps = {
	asset: AssetDetail;
};

/** One fact line: an icon, the translated label, and the formatted value. */
type Fact = { icon: KitIcon; label: string; value: string };

/** The figures come from assetQueryOptions. The strip keeps 3 equal cells at every width. */
export function AssetProfileCard({ asset }: AssetProfileCardProps) {
	const { t, locale } = useT();
	const compactMoney = moneyFormat(locale, "compact");
	const number = new Intl.NumberFormat(locale);
	const compactNumber = new Intl.NumberFormat(locale, {
		notation: "compact",
		maximumSignificantDigits: 3,
	});
	const facts: Fact[] = [
		{
			icon: ChartPieSliceIcon,
			label: t("asset.marketSize"),
			value: compactMoney.format(asset.marketSize),
		},
		{
			icon: ArrowsLeftRightIcon,
			label: t("asset.volume"),
			value: compactMoney.format(asset.volume24h),
		},
		{
			icon: CoinsIcon,
			label: t("asset.supply"),
			value: `${compactNumber.format(asset.circulatingSupply)} ${asset.symbol}`,
		},
		{
			icon: TrendUpIcon,
			label: t("asset.yearHigh"),
			value: formatPrice(asset.yearHigh, locale),
		},
		{
			icon: TrendDownIcon,
			label: t("asset.yearLow"),
			value: formatPrice(asset.yearLow, locale),
		},
	];

	return (
		<Card>
			<CardContent className="grid gap-8">
				<div className="grid justify-items-center gap-4 text-center">
					<AssetGlyph
						symbol={asset.symbol}
						category={asset.category}
						size="xl"
					/>
					<div className="grid gap-1">
						<p className="flex items-center justify-center gap-2 font-semibold text-xl">
							{asset.name}
							<Badge variant="info">{asset.symbol}</Badge>
						</p>
						<p className="text-muted-foreground text-sm">
							{t(`ledger.categories.${asset.category}`)}
						</p>
					</div>
				</div>
				<dl className="grid grid-cols-3 divide-x rounded-md border bg-muted text-center rtl:divide-x-reverse">
					<div className="grid gap-1 px-2 py-3">
						<dd className="order-1 font-semibold text-lg tabular-nums">
							{formatPrice(asset.price, locale)}
						</dd>
						<dt className="order-2 text-muted-foreground text-sm">
							{t("asset.price")}
						</dt>
					</div>
					<div className="grid gap-1 px-2 py-3">
						<dd className="order-1 font-semibold text-lg">
							<ChangeText
								change={asset.change24h}
								flatBelow={FLAT_MOVE_RATIO}
							/>
						</dd>
						<dt className="order-2 text-muted-foreground text-sm">
							{t("asset.change24hShort")}
						</dt>
					</div>
					<div className="grid gap-1 px-2 py-3">
						<dd className="order-1 font-semibold text-lg tabular-nums">
							{`#${number.format(asset.rank)}`}
						</dd>
						<dt className="order-2 text-muted-foreground text-sm">
							{t("asset.rankLabel")}
						</dt>
					</div>
				</dl>
				<ul className="grid gap-4 text-sm">
					{facts.map((fact) => (
						<li key={fact.label} className="flex items-center gap-3">
							<fact.icon className="size-4 shrink-0 text-muted-foreground" />
							<span className="text-muted-foreground">{fact.label}</span>
							<span className="ms-auto font-medium tabular-nums">
								{fact.value}
							</span>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
