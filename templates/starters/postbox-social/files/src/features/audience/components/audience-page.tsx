// The audience page, on the grid of the kit "classic dashboard" (the kit analytics widget page is empty):
// the period and the export in the header, then three cards (top cities, new followers, total followers),
// the inbox (1/3) beside the growth lines (2/3), and the parts table (2/3) beside the split card (1/3).
// The /app/audience route renders it after its loader. The page holds the period of the growth cards.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import {
	keepPreviousData,
	useQuery,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	CHANNELS,
	DEFAULT_DAYS,
	dayCountFormat,
	downloadCsv,
	fillMessage,
	LoadError,
	type PeriodDays,
	PeriodSelect,
	shareFormat,
	toCsv,
} from "~/features/social";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	audienceGrowthQueryOptions,
	audienceQueryOptions,
} from "../api/audience.queries";
import { GrowthCard } from "./growth-card";
import { InboxCard } from "./inbox-card";
import { AudiencePartsCard, AudienceSplitCard } from "./parts-cards";
import {
	NewFollowersCard,
	TopCitiesCard,
	TotalFollowersCard,
} from "./top-cards";

/** Three columns from the 4xl container width. One column on a phone. */
export function AudiencePage() {
	const { t, locale } = useT();
	const [days, setDays] = useState<PeriodDays>(DEFAULT_DAYS);
	const { data: audience } = useSuspenseQuery(audienceQueryOptions());
	// The loader fills the default period. Another period loads here and keeps the old numbers until it is ready.
	const growth = useQuery({
		...audienceGrowthQueryOptions(days),
		placeholderData: keepPreviousData,
	});
	const number = new Intl.NumberFormat(locale);
	const share = shareFormat(locale);

	function exportParts() {
		downloadCsv(
			"postbox-audience.csv",
			toCsv(
				[...audience.cities, ...audience.ages],
				[
					{
						header: t("audience.part"),
						value: (part) =>
							part.label === "other" ? t("audience.other") : part.label,
					},
					{
						header: t("audience.kind"),
						value: (part) => t(`audience.kinds.${part.kind}`),
					},
					{
						header: t("metrics.followers"),
						value: (part) => String(part.followers),
					},
					{
						header: t("audience.share"),
						value: (part) => share.format(part.share),
					},
				],
			),
		);
	}

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("audience.title")}
				description={fillMessage(t("audience.description"), {
					followers: number.format(audience.totalFollowers),
					channels: number.format(CHANNELS.length),
					period: dayCountFormat(locale).format(days),
				})}
				actions={
					<>
						<PeriodSelect days={days} onDaysChange={setDays} />
						<Button
							type="button"
							onClick={exportParts}
							aria-label={t("audience.exportCsv")}
						>
							<DownloadSimpleIcon />
							<span className="@4xl/main:inline hidden">
								{t("audience.exportCsv")}
							</span>
						</Button>
					</>
				}
			/>
			<div className="grid @4xl/main:grid-cols-3 gap-4">
				<TopCitiesCard cities={audience.cities} />
				{growth.data ? (
					<>
						<NewFollowersCard growth={growth.data} />
						<TotalFollowersCard growth={growth.data} />
					</>
				) : growth.isError ? (
					<p role="alert" className="@4xl/main:col-span-2">
						{t("audience.growthError")}
					</p>
				) : (
					<>
						<Skeleton className="h-64" />
						<Skeleton className="h-64" />
					</>
				)}
				<InboxCard />
				<div className="@4xl/main:col-span-2">
					{growth.data ? (
						<GrowthCard growth={growth.data} />
					) : (
						<Skeleton className="h-full min-h-96" />
					)}
				</div>
				<div className="@4xl/main:col-span-2">
					<AudiencePartsCard audience={audience} />
				</div>
				<AudienceSplitCard audience={audience} />
			</div>
		</div>
	);
}

/** Loading state of the audience page: the header and the three rows of cards. */
export function AudiencePageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-40" />
					<Skeleton className="h-4 w-80 max-w-full" />
				</div>
				<Skeleton className="h-9 w-56" />
			</div>
			<div className="grid @4xl/main:grid-cols-3 gap-4">
				<Skeleton className="h-64" />
				<Skeleton className="h-64" />
				<Skeleton className="h-64" />
				<Skeleton className="h-96" />
				<Skeleton className="@4xl/main:col-span-2 h-96" />
			</div>
		</div>
	);
}

/** Error state of the audience page when the loader fails. Try again runs the loader again. */
export function AudiencePageError() {
	const { t } = useT();
	return <LoadError message={t("audience.loadError")} />;
}
