// The feature card of the account page: which features the people of the account use, and how many of them.
// AccountDetailPage renders it with the features that the account query returns. A feature with no user stays in the list.
import { ShareBar, shareFormat } from "~/features/tracking";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import type { AccountFeature } from "../api/accounts.queries";

type AccountFeaturesCardProps = {
	/** Every feature, the most used first. */
	features: AccountFeature[];
};

/** A feature that nobody used shows "Not used" and an empty bar: it is a topic for the next talk with the account. */
export function AccountFeaturesCard({ features }: AccountFeaturesCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const share = shareFormat(locale);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("accounts.features.title")}</CardTitle>
				<CardDescription>{t("accounts.features.description")}</CardDescription>
			</CardHeader>
			<CardContent>
				<ul className="grid gap-4">
					{features.map((feature) => (
						<li key={feature.area} className="grid gap-2">
							<div className="flex items-baseline gap-3 text-sm">
								<span className="min-w-0 flex-1 truncate font-medium">
									{t(`areas.${feature.area}`)}
								</span>
								{feature.people === 0 ? (
									<span className="text-muted-foreground">
										{t("accounts.features.notUsed")}
									</span>
								) : (
									<>
										<span className="text-muted-foreground tabular-nums">
											{number.format(feature.people)}
										</span>
										<span className="w-10 text-end font-medium tabular-nums">
											{share.format(feature.share)}
										</span>
									</>
								)}
							</div>
							<ShareBar share={feature.share} />
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
