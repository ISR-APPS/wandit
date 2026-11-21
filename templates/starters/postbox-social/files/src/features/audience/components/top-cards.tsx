// The first row of the audience page, three cards: the top cities as a list of people-like rows,
// the new followers with a bar per group of days, and the follower total with a line.
// AudiencePage renders them with the audience profile and the growth of the chosen period.
import { lazy, Suspense } from "react";
import {
	countForm,
	DeltaText,
	fillMessage,
	shareFormat,
} from "~/features/social";
import { useT } from "~/shared/i18n";
import { Avatar, AvatarFallback } from "~/shared/ui/avatar";
import { Badge } from "~/shared/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import type { AudienceGrowth, AudiencePart } from "../api/audience.queries";

// The chart file holds the chart library. A lazy import keeps it out of the first script of the app.
const GainBars = lazy(() =>
	import("./audience-charts").then((module) => ({ default: module.GainBars })),
);
const FollowersLine = lazy(() =>
	import("./audience-charts").then((module) => ({
		default: module.FollowersLine,
	})),
);

// The card lists the three largest cities, as the kit card lists three people.
const SHOWN_CITIES = 3;

type TopCitiesCardProps = {
	/** The cities, largest first, then "other". */
	cities: AudiencePart[];
};

/** "Other" never shows here: it is not a city. The table under the cards lists every part. */
export function TopCitiesCard({ cities }: TopCitiesCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const share = shareFormat(locale);
	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("audience.citiesTitle")}</CardTitle>
				<CardDescription>{t("audience.citiesDescription")}</CardDescription>
			</CardHeader>
			<CardContent>
				<ul className="grid gap-6">
					{cities
						.filter((city) => city.label !== "other")
						.slice(0, SHOWN_CITIES)
						.map((city) => (
							<li
								key={city.id}
								className="flex items-center justify-between gap-3"
							>
								<div className="flex min-w-0 items-center gap-4">
									<Avatar>
										<AvatarFallback className="bg-muted">
											{city.label.slice(0, 2)}
										</AvatarFallback>
									</Avatar>
									<div className="grid min-w-0">
										<span className="truncate text-sm">{city.label}</span>
										<span className="truncate text-muted-foreground text-sm tabular-nums">
											{fillMessage(
												t(
													`audience.followersCount.${countForm(locale, city.followers)}`,
												),
												{
													count: number.format(city.followers),
												},
											)}
										</span>
									</div>
								</div>
								<Badge variant="outline" className="h-9 px-3 tabular-nums">
									{share.format(city.share)}
								</Badge>
							</li>
						))}
				</ul>
			</CardContent>
		</Card>
	);
}

type GrowthFigureCardProps = {
	growth: AudienceGrowth;
};

/** The net new followers of the period. A negative period shows the minus sign, never a plus. */
export function NewFollowersCard({ growth }: GrowthFigureCardProps) {
	const { t, locale } = useT();
	const signed = new Intl.NumberFormat(locale, { signDisplay: "exceptZero" });
	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("audience.newFollowersTitle")}</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-4">
				<div className="grid gap-1">
					<p className="font-numeric font-semibold text-3xl tabular-nums">
						<bdi dir="ltr">{signed.format(growth.gain)}</bdi>
					</p>
					<p className="text-muted-foreground text-xs">
						<DeltaText change={growth.gainChange} />{" "}
						{t("audience.fromPrevious")}
					</p>
				</div>
				<Suspense fallback={<Skeleton className="h-28 w-full" />}>
					<GainBars
						buckets={growth.buckets}
						seriesLabel={t("audience.newFollowersTitle")}
					/>
				</Suspense>
			</CardContent>
		</Card>
	);
}

/** The follower total at the end of yesterday and its line over the period. */
export function TotalFollowersCard({ growth }: GrowthFigureCardProps) {
	const { t, locale } = useT();
	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("audience.totalTitle")}</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-4">
				<div className="grid gap-1">
					<p className="font-numeric font-semibold text-3xl tabular-nums">
						{new Intl.NumberFormat(locale).format(growth.followers)}
					</p>
					<p className="text-muted-foreground text-xs">
						<DeltaText change={growth.followersChange} />{" "}
						{t("audience.fromPrevious")}
					</p>
				</div>
				<Suspense fallback={<Skeleton className="h-28 w-full" />}>
					<FollowersLine
						points={growth.followerPoints}
						seriesLabel={t("metrics.followers")}
					/>
				</Suspense>
			</CardContent>
		</Card>
	);
}
