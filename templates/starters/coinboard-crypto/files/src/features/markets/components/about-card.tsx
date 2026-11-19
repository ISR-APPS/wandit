// The about card of the asset page: two sentences about the project, then badges of its category, direction, and account.
// AssetDetailPage renders it last in the start column of the Overview tab.
import type { AssetPosition } from "~/features/holdings";
import { fillMessage, PRICE_MOVE_BADGE } from "~/features/ledger";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import type { AssetDetail } from "../api/assets.queries";

type AboutCardProps = {
	asset: AssetDetail;
	/** The position from assetPositionQueryOptions. A held asset adds a badge with its account. */
	position: AssetPosition;
};

/** The badges are facts of the asset, never links. */
export function AboutCard({ asset, position }: AboutCardProps) {
	const { t } = useT();
	return (
		<Card>
			<CardHeader>
				<CardTitle>
					{fillMessage(t("asset.aboutTitle"), { name: asset.name })}
				</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-4">
				<p className="text-muted-foreground text-sm leading-relaxed">
					{asset.about}
				</p>
				<div className="flex flex-wrap gap-2">
					<Badge variant="outline">
						{t(`ledger.categories.${asset.category}`)}
					</Badge>
					<Badge variant={PRICE_MOVE_BADGE[asset.move]}>
						{t(`ledger.moves.${asset.move}`)}
					</Badge>
					<Badge variant="outline">
						{position.held
							? fillMessage(t("asset.heldIn"), {
									account: t(`ledger.accounts.${position.held.account}`),
								})
							: t("markets.notHeld")}
					</Badge>
				</div>
			</CardContent>
		</Card>
	);
}
