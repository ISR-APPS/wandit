// The audience page behind login: the daily growth, the followers by channel, the ages, the cities, and the online hours.
// The /app/audience route renders it after its loader. The route also uses the skeleton and the error below.
// The period tabs change the two growth cards. The other cards describe the audience at the end of yesterday.
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	CHANNELS,
	DEFAULT_DAYS,
	dayCountFormat,
	fillMessage,
	LoadError,
	type PeriodDays,
	PeriodTabs,
} from "~/features/social";
import { useT } from "~/shared/i18n";
import { Skeleton } from "~/shared/ui/skeleton";
import { audienceQueryOptions } from "../api/audience.queries";
import { AudiencePartsCard } from "./audience-parts-card";
import { FollowerGrowthCard } from "./follower-growth-card";
import { GainByChannelCard } from "./gain-by-channel-card";
import { OnlineHoursCard } from "./online-hours-card";

/** The first row: the growth spans 2 of 3 columns beside the donut. The cards of one row stretch to equal heights. */
const PAGE_GRID =
	"grid grid-cols-1 gap-4 @3xl/main:gap-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-3";

/** The header names the follower total and the period of the growth. */
export function AudiencePage() {
	const { t, locale } = useT();
	const [days, setDays] = useState<PeriodDays>(DEFAULT_DAYS);
	const { data: audience } = useSuspenseQuery(audienceQueryOptions());
	const number = new Intl.NumberFormat(locale);

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("audience.title")}
				description={fillMessage(t("audience.description"), {
					followers: number.format(audience.totalFollowers),
					channels: number.format(CHANNELS.length),
					period: dayCountFormat(locale).format(days),
				})}
				actions={<PeriodTabs days={days} onDaysChange={setDays} />}
			/>
			<div className={PAGE_GRID}>
				<FollowerGrowthCard
					days={days}
					className="@5xl/main:col-span-2 @xl/main:col-span-2"
				/>
				<GainByChannelCard days={days} />
				<AudiencePartsCard
					title={t("audience.agesTitle")}
					description={t("audience.agesDescription")}
					parts={audience.ages}
					isRanked={false}
				/>
				<AudiencePartsCard
					title={t("audience.citiesTitle")}
					description={t("audience.citiesDescription")}
					parts={audience.cities}
					isRanked
				/>
				<OnlineHoursCard levels={audience.onlineLevels} />
			</div>
		</div>
	);
}

/** Placeholder while the audience loader runs. The route sets it as pendingComponent. */
export function AudiencePageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-36" />
					<Skeleton className="h-4 w-96 max-w-full" />
				</div>
				<Skeleton className="h-9 w-64" />
			</div>
			<div className={PAGE_GRID}>
				<Skeleton className="@xl/main:col-span-2 h-80" />
				<Skeleton className="h-80" />
				<Skeleton className="h-80" />
				<Skeleton className="h-80" />
				<Skeleton className="h-80" />
			</div>
		</div>
	);
}

/** Error state of the audience page when the loader fails. */
export function AudiencePageError() {
	const { t } = useT();
	return <LoadError message={t("audience.loadError")} />;
}
