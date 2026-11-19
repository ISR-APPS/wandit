// The sale progress card of a listing detail page: one bar and the percent of the sale steps
// that the home reached (listed, first enquiry, first viewing, accepted offer, sold).
// ListingDetailPage renders it under the profile card.
import { fillMessage } from "~/features/agency";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";
import { SALE_STEPS } from "../lib/listing-timeline";

type ListingProgressCardProps = {
	/** The count of sale steps that the home reached, from 0 to 5. */
	stepsDone: number;
};

/** The description names the steps in words, so the bar is never the only mark. */
export function ListingProgressCard({ stepsDone }: ListingProgressCardProps) {
	const { t, locale } = useT();
	const percent = new Intl.NumberFormat(locale, { style: "percent" });
	const share = stepsDone / SALE_STEPS.length;
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("listings.progress.title")}</CardTitle>
				<CardDescription>
					{fillMessage(t("listings.progress.steps"), {
						done: stepsDone,
						total: SALE_STEPS.length,
					})}
				</CardDescription>
			</CardHeader>
			<CardContent className="flex items-center gap-4">
				<Progress
					value={share * 100}
					aria-label={t("listings.progress.title")}
				/>
				<span className="text-muted-foreground text-sm tabular-nums">
					{percent.format(share)}
				</span>
			</CardContent>
		</Card>
	);
}
