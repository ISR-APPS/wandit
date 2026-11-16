// The product mix of one rep in the current quarter, as ranked bars.
// RepDetailPage renders it in the rail. The product line codes are translated here.
import { RankedBars } from "~/features/sales";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import type { RepDetail } from "../api/reps.queries";

type RepMixCardProps = {
	productMix: RepDetail["productMix"];
};

/** One row per product line with a booking. No booking yet shows one sentence. */
export function RepMixCard({ productMix }: RepMixCardProps) {
	const { t } = useT();
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("reps.productMixTitle")}</CardTitle>
			</CardHeader>
			<CardContent>
				{productMix.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("reps.productMixEmpty")}
					</p>
				) : (
					<RankedBars
						slices={productMix.map((part) => ({
							label: t(`productLines.${part.productLine}`),
							value: part.amount,
						}))}
					/>
				)}
			</CardContent>
		</Card>
	);
}
