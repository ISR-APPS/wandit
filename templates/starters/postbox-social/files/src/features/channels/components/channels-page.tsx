// The channel list behind login: the total of all accounts, then one card per channel.
// The /app/channels route renders it after its loader. The route also uses the skeleton and the error below.
import { useSuspenseQuery } from "@tanstack/react-query";
import { PageHeader } from "~/features/app-shell";
import { fillMessage, LoadError } from "~/features/social";
import { useT } from "~/shared/i18n";
import { Skeleton } from "~/shared/ui/skeleton";
import { channelsQueryOptions } from "../api/channels.queries";
import { AllChannelsCard } from "./all-channels-card";
import { ChannelCard } from "./channel-card";

/** Six cards: the total and the five channels, in 1, 2, or 3 columns by the width of the main area. */
const CARD_GRID =
	"grid grid-cols-1 gap-4 @3xl/main:gap-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-3";

/** The page header names the period of the cards: the last 30 days to yesterday. */
export function ChannelsPage() {
	const { t, locale } = useT();
	const { data: summaries } = useSuspenseQuery(channelsQueryOptions());
	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("channels.title")}
				description={fillMessage(t("channels.description"), {
					count: new Intl.NumberFormat(locale).format(summaries.length),
				})}
			/>
			<div className={CARD_GRID}>
				<AllChannelsCard summaries={summaries} />
				{summaries.map((summary) => (
					<ChannelCard key={summary.profile.id} summary={summary} />
				))}
			</div>
		</div>
	);
}

// Fixed keys of the six placeholder cards.
const SKELETON_CARDS = ["1", "2", "3", "4", "5", "6"];

/** Placeholder while the list loader runs. The route sets it as pendingComponent. */
export function ChannelsPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-36" />
				<Skeleton className="h-4 w-96 max-w-full" />
			</div>
			<div className={CARD_GRID}>
				{SKELETON_CARDS.map((key) => (
					<Skeleton key={key} className="h-80" />
				))}
			</div>
		</div>
	);
}

/** Error state of the channel pages when a loader fails. */
export function ChannelsPageError() {
	const { t } = useT();
	return <LoadError message={t("channels.loadError")} />;
}
