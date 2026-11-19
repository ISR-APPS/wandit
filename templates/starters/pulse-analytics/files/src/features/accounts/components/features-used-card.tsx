// The features card of the account page: one outline badge per feature area that the account used in 30 days.
// AccountOverview renders it last in the start column.
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import type { AccountFeature } from "../api/accounts.queries";

type FeaturesUsedCardProps = {
	/** Every feature of the product in this account, the most used first. */
	features: AccountFeature[];
};

/** A feature with no user in the period gets no badge. No used feature shows one sentence. */
export function FeaturesUsedCard({ features }: FeaturesUsedCardProps) {
	const { t } = useT();
	const used = features.filter((feature) => feature.people > 0);
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("accounts.features.title")}</CardTitle>
			</CardHeader>
			<CardContent>
				{used.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("accounts.features.none")}
					</p>
				) : (
					<ul className="flex flex-wrap gap-2">
						{used.map((feature) => (
							<li key={feature.area}>
								<Badge variant="outline">{t(`areas.${feature.area}`)}</Badge>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
