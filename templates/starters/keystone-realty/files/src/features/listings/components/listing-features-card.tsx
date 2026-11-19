// The features card of a listing detail page: the selling points of the home as outline badges.
// ListingDetailPage renders it under the sale progress card.
import type { ListingRow } from "~/features/agency";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";

type ListingFeaturesCardProps = {
	features: ListingRow["features"];
};

/** A home with no listed feature shows one sentence. */
export function ListingFeaturesCard({ features }: ListingFeaturesCardProps) {
	const { t } = useT();
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("listings.featuresTitle")}</CardTitle>
			</CardHeader>
			<CardContent>
				{features.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("listings.noFeatures")}
					</p>
				) : (
					<ul className="flex flex-wrap gap-2">
						{features.map((feature) => (
							<li key={feature}>
								<Badge variant="outline">
									{t(`agency.features.${feature}`)}
								</Badge>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
