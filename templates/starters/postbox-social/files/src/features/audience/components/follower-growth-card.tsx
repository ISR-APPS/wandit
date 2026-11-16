// The growth trend of the audience page: net new followers per day on all channels, with the total of the period.
// AudiencePage renders it first. The period comes from the page header; the card reads it with useQuery.
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChangePill, changeRatio, DailyAreaChart } from "~/features/social";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import { followerGrowthQueryOptions } from "../api/audience.queries";

type FollowerGrowthCardProps = {
	/** The period of the page, in days. */
	days: number;
	/** The extra classes of the card, for its column span. */
	className?: string;
};

/** The total sits in the header beside the title, with its change against the period before. */
export function FollowerGrowthCard({
	days,
	className,
}: FollowerGrowthCardProps) {
	const { t, locale } = useT();
	const query = useQuery({
		...followerGrowthQueryOptions(days),
		placeholderData: keepPreviousData,
	});
	const signed = new Intl.NumberFormat(locale, { signDisplay: "exceptZero" });
	const points = query.data ?? [];
	const current = points.reduce((sum, point) => sum + point.current, 0);
	const previous = points.reduce((sum, point) => sum + point.previous, 0);
	const change = changeRatio(current, previous);

	return (
		<Card className={className}>
			<CardHeader>
				<CardTitle>{t("audience.growthTitle")}</CardTitle>
				<CardDescription>{t("audience.growthDescription")}</CardDescription>
				<CardAction className="grid justify-items-end gap-1">
					<span className="text-muted-foreground text-xs">
						{t("audience.growthTotal")}
					</span>
					<span className="flex items-center gap-2">
						<bdi dir="ltr" className="font-numeric text-2xl tabular-nums">
							{query.data ? signed.format(current) : "–"}
						</bdi>
						{change === null ? null : (
							<ChangePill change={change} goodWhen="up" />
						)}
					</span>
				</CardAction>
			</CardHeader>
			<CardContent>
				{query.isError ? (
					<p role="alert" className="text-sm">
						{t("audience.loadError")}
					</p>
				) : query.data ? (
					<DailyAreaChart
						points={points}
						seriesLabel={t("audience.growthTitle")}
						className="h-64"
					/>
				) : (
					<Skeleton className="h-64" />
				)}
			</CardContent>
		</Card>
	);
}
