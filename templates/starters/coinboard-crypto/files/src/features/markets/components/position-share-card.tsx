// The position card of the asset page: the part of the portfolio that this asset is, as a bar and a percent,
// with the units and their value. AssetDetailPage renders it second in the start column of the Overview tab.

import type { AssetPosition } from "~/features/holdings";
import {
	fillMessage,
	formatQuantity,
	moneyFormat,
	shareFormat,
} from "~/features/ledger";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";

type PositionShareCardProps = {
	/** The ticker of the asset, for the units line. */
	symbol: string;
	/** The position from assetPositionQueryOptions. `held` is null when the user holds no unit now. */
	position: AssetPosition;
};

/** No unit held shows one sentence and no bar, never a "0%" bar. */
export function PositionShareCard({
	symbol,
	position,
}: PositionShareCardProps) {
	const { t, locale } = useT();
	const held = position.held;

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("asset.shareTitle")}</CardTitle>
				<CardDescription>
					{held
						? fillMessage(t("asset.shareLine"), {
								line: `${formatQuantity(held.quantity, locale)} ${symbol}`,
								value: moneyFormat(locale).format(held.value),
								account: t(`ledger.accounts.${held.account}`),
							})
						: fillMessage(t("asset.noPosition"), { symbol })}
				</CardDescription>
			</CardHeader>
			{held ? (
				<CardContent className="flex items-center gap-4">
					<Progress
						value={held.share * 100}
						className="h-2 flex-1"
						aria-label={t("asset.shareTitle")}
					/>
					<span className="text-muted-foreground text-sm tabular-nums">
						{shareFormat(locale).format(held.share)}
					</span>
				</CardContent>
			) : null}
		</Card>
	);
}
