// The ranked panel of the home: the most used features, with the share of the active people that used each one.
// OverviewPage renders it and holds the period. The panel reads the ranking of that period itself.
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
	PanelError,
	type PeriodDays,
	ShareBar,
	shareFormat,
} from "~/features/tracking";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import { featureAdoptionQueryOptions } from "../api/overview.queries";

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6"];

type FeatureAdoptionCardProps = {
	/** The period of the ranking, in complete days. OverviewPage holds it. */
	days: PeriodDays;
};

/** One line per feature: the rank, the name, the people, the share, and a bar of the share. */
export function FeatureAdoptionCard({ days }: FeatureAdoptionCardProps) {
	const { t, locale } = useT();
	const adoption = useQuery({
		...featureAdoptionQueryOptions(days),
		placeholderData: keepPreviousData,
	});
	const number = new Intl.NumberFormat(locale);
	const share = shareFormat(locale);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("overview.features.title")}</CardTitle>
				<CardDescription>{t("overview.features.description")}</CardDescription>
			</CardHeader>
			<CardContent>
				{adoption.isError ? (
					<PanelError
						message={t("overview.features.error")}
						onRetry={() => adoption.refetch()}
						className="h-72"
					/>
				) : adoption.data === undefined ? (
					<div className="grid gap-5">
						{SKELETON_ROWS.map((key) => (
							<Skeleton key={key} className="h-8 w-full" />
						))}
					</div>
				) : (
					<ol className="grid gap-5">
						{adoption.data.map((feature, index) => (
							<li key={feature.area} className="grid gap-2">
								<div className="flex items-baseline gap-3 text-sm">
									<span className="w-4 text-muted-foreground tabular-nums">
										{number.format(index + 1)}
									</span>
									<span className="min-w-0 flex-1 truncate font-medium">
										{t(`areas.${feature.area}`)}
									</span>
									<span className="text-muted-foreground tabular-nums">
										{number.format(feature.people)}
									</span>
									<span className="w-10 text-end font-medium tabular-nums">
										{share.format(feature.share)}
									</span>
								</div>
								<ShareBar share={feature.share} className="ms-7 w-auto" />
							</li>
						))}
					</ol>
				)}
			</CardContent>
		</Card>
	);
}
