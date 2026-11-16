// The market stats card of the asset page: the market cap, the volume, the supply, and the 52-week range.
// AssetDetailPage renders it in the rail with the asset of the page.
import {
	ChangeText,
	changeRatio,
	FLAT_MOVE_RATIO,
	fillMessage,
	formatPrice,
	moneyFormat,
	signedPercentFormat,
} from "~/features/ledger";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import type { AssetDetail } from "../api/assets.queries";

type MarketStatsCardProps = {
	/** The asset of the page, with its year range. */
	asset: AssetDetail;
};

/** The range track marks where the current price sits between the low and the high of the year. */
export function MarketStatsCard({ asset }: MarketStatsCardProps) {
	const { t, locale } = useT();
	const compactMoney = moneyFormat(locale, "compact");
	const compactNumber = new Intl.NumberFormat(locale, {
		notation: "compact",
		maximumSignificantDigits: 3,
	});
	const range = asset.yearHigh - asset.yearLow;
	// 0 at the year low, 100 at the year high. A flat year puts the mark in the middle.
	const rangePosition =
		range === 0 ? 50 : ((asset.price - asset.yearLow) / range) * 100;
	const fromHigh = changeRatio(asset.price, asset.yearHigh);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("asset.statsTitle")}</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-4">
				<dl className="grid gap-2.5 text-sm">
					<div className="flex items-baseline justify-between gap-3">
						<dt className="text-muted-foreground">{t("asset.marketSize")}</dt>
						<dd className="tabular-nums">
							{compactMoney.format(asset.marketSize)}
						</dd>
					</div>
					<div className="flex items-baseline justify-between gap-3">
						<dt className="text-muted-foreground">{t("asset.volume")}</dt>
						<dd className="tabular-nums">
							{compactMoney.format(asset.volume24h)}
						</dd>
					</div>
					<div className="flex items-baseline justify-between gap-3">
						<dt className="text-muted-foreground">{t("asset.supply")}</dt>
						<dd className="tabular-nums">
							{`${compactNumber.format(asset.circulatingSupply)} ${asset.symbol}`}
						</dd>
					</div>
					<div className="flex items-baseline justify-between gap-3">
						<dt className="text-muted-foreground">{t("asset.change24h")}</dt>
						{/* The Markets tabs and the home call a move under FLAT_MOVE_RATIO "Flat", so it shows muted here too. */}
						<dd>
							<ChangeText
								change={asset.change24h}
								flatBelow={FLAT_MOVE_RATIO}
							/>
						</dd>
					</div>
					<div className="flex items-baseline justify-between gap-3">
						<dt className="text-muted-foreground">{t("asset.change7d")}</dt>
						<dd>
							<ChangeText change={asset.change7d} flatBelow={FLAT_MOVE_RATIO} />
						</dd>
					</div>
				</dl>
				<div className="grid gap-2 border-t pt-4 text-sm">
					<div className="flex items-baseline justify-between gap-3">
						<span className="text-muted-foreground">{t("asset.yearLow")}</span>
						<span className="text-muted-foreground">{t("asset.yearHigh")}</span>
					</div>
					{/* The two prices under the track give the range, so screen readers skip the track. */}
					<div
						aria-hidden="true"
						className="relative h-1.5 rounded-sm bg-muted"
					>
						<span
							className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-card bg-chart-1 rtl:translate-x-1/2"
							style={{ insetInlineStart: `${rangePosition}%` }}
						/>
					</div>
					<div className="flex items-baseline justify-between gap-3 font-medium tabular-nums">
						<span>{formatPrice(asset.yearLow, locale)}</span>
						<span>{formatPrice(asset.yearHigh, locale)}</span>
					</div>
					{fromHigh === null ? null : (
						<p className="text-muted-foreground text-xs">
							{fillMessage(t("asset.fromHigh"), {
								change: signedPercentFormat(locale).format(fromHigh),
							})}
						</p>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
