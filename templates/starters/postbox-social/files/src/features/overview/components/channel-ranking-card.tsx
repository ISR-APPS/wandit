// The ranked parts of the home: the engagements of each channel in the period, with a share bar in the channel color.
// The footer gives the total of all channels.
// OverviewPage renders it under the trend. It reads the ranking of the chosen period with useQuery.
// A channel has no link here: the post list filters by channel, but the ranking counts days, not posts.
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
	CHANNEL_TONES,
	ChannelMark,
	channelProfile,
	ShareBar,
	shareFormat,
} from "~/features/social";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import { engagementsByChannelQueryOptions } from "../api/overview.queries";
import { PanelError } from "./panel-error";

type ChannelRankingCardProps = {
	/** The period of the page, in days. */
	days: number;
};

// Fixed keys of the five placeholder rows.
const SKELETON_ROWS = ["1", "2", "3", "4", "5"];

/** The bar width is the value over the largest value. The share of the total stands as text. */
export function ChannelRankingCard({ days }: ChannelRankingCardProps) {
	const { t, locale } = useT();
	const query = useQuery({
		...engagementsByChannelQueryOptions(days),
		placeholderData: keepPreviousData,
	});
	const number = new Intl.NumberFormat(locale);
	const share = shareFormat(locale);

	if (query.isError) {
		return <PanelError message={t("overview.rankingError")} />;
	}
	const rows = query.data ?? [];
	const largest = Math.max(...rows.map((row) => row.engagements), 1);
	const total = rows.reduce((sum, row) => sum + row.engagements, 0);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("overview.rankingTitle")}</CardTitle>
				<CardDescription>{t("overview.rankingDescription")}</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-1 flex-col gap-5">
				<ol className="grid gap-5">
					{query.isPending
						? SKELETON_ROWS.map((key) => (
								<li key={key}>
									<Skeleton className="h-11 w-full" />
								</li>
							))
						: rows.map((row, index) => (
								<li
									key={row.channelId}
									className="grid grid-cols-[1.25rem_auto_1fr] items-center gap-x-3 gap-y-2"
								>
									<span className="text-muted-foreground text-sm tabular-nums">
										{number.format(index + 1)}
									</span>
									<ChannelMark channelId={row.channelId} size="sm" />
									<div className="flex min-w-0 items-baseline justify-between gap-3">
										<span className="min-w-0 truncate text-sm">
											<span className="font-medium">
												{t(`channels.names.${row.channelId}`)}
											</span>
											{/* The handle needs room. A phone shows the channel name only. */}
											<span className="ms-2 @xl/main:inline hidden text-muted-foreground text-xs">
												<bdi>{channelProfile(row.channelId).handle}</bdi>
											</span>
										</span>
										<span className="flex shrink-0 items-baseline gap-3 text-sm tabular-nums">
											{number.format(row.engagements)}
											<span className="w-10 text-end text-muted-foreground">
												{share.format(row.share)}
											</span>
										</span>
									</div>
									<ShareBar
										share={row.engagements / largest}
										fillClassName={CHANNEL_TONES[row.channelId].solid}
										className="col-start-3"
									/>
								</li>
							))}
				</ol>
				{/* The total sits at the bottom edge, so the card ends level with the latest posts beside it. */}
				<div className="mt-auto flex items-baseline justify-between gap-3 border-border border-t pt-4 text-sm">
					<span className="text-muted-foreground">
						{t("overview.rankingTotal")}
					</span>
					{query.isPending ? (
						<Skeleton className="h-5 w-20" />
					) : (
						<span className="font-medium tabular-nums">
							{number.format(total)}
						</span>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
