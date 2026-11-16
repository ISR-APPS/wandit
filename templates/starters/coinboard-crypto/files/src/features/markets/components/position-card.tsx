// The position card of the asset page: what the user holds of this asset, its cost, and its profit.
// AssetDetailPage renders it in the rail. An asset with no unit shows one sentence, and the profit of past sales.
import type { AssetPosition } from "~/features/holdings";
import {
	ChangeText,
	fillMessage,
	formatPrice,
	formatQuantity,
	moneyFormat,
	shareFormat,
	signedMoneyFormat,
} from "~/features/ledger";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";

type PositionCardProps = {
	/** The ticker of the asset, for the units and the empty sentence. */
	symbol: string;
	/** The position of the user in this asset, from assetPositionQueryOptions(). */
	position: AssetPosition;
};

/** The realized profit row shows only after a sale. */
export function PositionCard({ symbol, position }: PositionCardProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const signedMoney = signedMoneyFormat(locale);
	const { held, realizedProfit } = position;
	const realizedRow =
		realizedProfit === 0 ? null : (
			<div className="flex items-baseline justify-between gap-3">
				<dt className="text-muted-foreground">{t("asset.realized")}</dt>
				{/* dir="ltr" keeps the sign in front of the amount in an Arabic page. */}
				<dd className="tabular-nums">
					<bdi dir="ltr">{signedMoney.format(realizedProfit)}</bdi>
				</dd>
			</div>
		);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("asset.positionTitle")}</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-4">
				{held ? (
					<>
						<div className="grid gap-1">
							<p className="font-numeric font-semibold text-3xl tabular-nums">
								{money.format(held.value)}
							</p>
							<p className="flex flex-wrap items-baseline gap-x-2 text-sm">
								<bdi dir="ltr" className="font-medium tabular-nums">
									{signedMoney.format(held.profit)}
								</bdi>
								{held.profitRatio === null ? null : (
									<ChangeText change={held.profitRatio} />
								)}
								<span className="text-muted-foreground">
									{t("asset.unrealized")}
								</span>
							</p>
						</div>
						<dl className="grid gap-2.5 border-t pt-4 text-sm">
							<div className="flex items-baseline justify-between gap-3">
								<dt className="text-muted-foreground">{t("asset.quantity")}</dt>
								<dd className="tabular-nums">
									{`${formatQuantity(held.quantity, locale)} ${symbol}`}
								</dd>
							</div>
							<div className="flex items-baseline justify-between gap-3">
								<dt className="text-muted-foreground">
									{t("asset.averageCost")}
								</dt>
								<dd className="tabular-nums">
									{formatPrice(held.averageCost, locale)}
								</dd>
							</div>
							<div className="flex items-baseline justify-between gap-3">
								<dt className="text-muted-foreground">
									{t("asset.costBasis")}
								</dt>
								<dd className="tabular-nums">{money.format(held.costBasis)}</dd>
							</div>
							{realizedRow}
							<div className="flex items-baseline justify-between gap-3">
								<dt className="text-muted-foreground">{t("asset.heldIn")}</dt>
								<dd>{t(`ledger.accounts.${held.account}`)}</dd>
							</div>
						</dl>
						<div className="grid gap-2 border-t pt-4 text-sm">
							<div className="flex items-baseline justify-between gap-3">
								<span className="text-muted-foreground">
									{t("asset.share")}
								</span>
								<span className="font-medium tabular-nums">
									{shareFormat(locale).format(held.share)}
								</span>
							</div>
							{/* The percent above gives the share, so screen readers skip the bar. */}
							<div
								aria-hidden="true"
								className="h-1.5 overflow-hidden rounded-sm bg-muted"
							>
								<div
									className="h-full rounded-sm bg-chart-1"
									style={{ width: `${held.share * 100}%` }}
								/>
							</div>
						</div>
					</>
				) : (
					<>
						<p className="text-muted-foreground text-sm">
							{fillMessage(t("asset.noPosition"), { symbol })}
						</p>
						{realizedRow ? (
							<dl className="grid gap-2.5 border-t pt-4 text-sm">
								{realizedRow}
							</dl>
						) : null}
					</>
				)}
			</CardContent>
		</Card>
	);
}
