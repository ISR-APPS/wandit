// One channel on the list page: the account, its followers with the 30-day growth, a follower spark, and three figures.
// ChannelsPage renders one card per channel. The whole card is a link to the channel page.
import { Link } from "@tanstack/react-router";
import {
	CHANNEL_TONES,
	ChangePill,
	ChannelMark,
	DailyAreaChart,
	fillMessage,
} from "~/features/social";
import { useT } from "~/shared/i18n";
import { Card, CardContent } from "~/shared/ui/card";
import type { ChannelSummary } from "../api/channels.queries";

type ChannelCardProps = {
	/** One row of channelsQueryOptions. */
	summary: ChannelSummary;
};

/** The card is clickable, so it gets a hover state. The spark keeps its tooltip and its screen reader text. */
export function ChannelCard({ summary }: ChannelCardProps) {
	const { t, locale } = useT();
	const { profile, figures } = summary;
	const number = new Intl.NumberFormat(locale);
	const signed = new Intl.NumberFormat(locale, { signDisplay: "exceptZero" });
	const compact = new Intl.NumberFormat(locale, {
		notation: "compact",
		maximumFractionDigits: 1,
	});
	// Two decimals, the same as the figure strip of the channel page, so both pages show the same rate.
	const rate = new Intl.NumberFormat(locale, {
		style: "percent",
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	});
	const name = t(`channels.names.${profile.id}`);

	return (
		<Card className="relative gap-4 transition-colors hover:border-ring/60">
			<CardContent className="grid gap-4">
				<div className="flex items-center gap-3">
					<ChannelMark channelId={profile.id} />
					<div className="grid min-w-0">
						{/* The link covers the card through its after layer, so one tab stop opens the channel. */}
						<Link
							to="/app/channels/$channelId"
							params={{ channelId: profile.id }}
							className="truncate font-medium after:absolute after:inset-0 after:rounded-surface focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-ring"
						>
							{name}
						</Link>
						<span className="truncate text-muted-foreground text-xs">
							<bdi>{profile.handle}</bdi>
						</span>
					</div>
				</div>
				<div className="grid gap-1">
					<span className="label-text text-muted-foreground text-xs">
						{t("metrics.followers")}
					</span>
					<div className="flex flex-wrap items-center gap-2">
						<span className="font-numeric text-3xl tabular-nums">
							{number.format(figures.followers)}
						</span>
						<span className="flex items-center gap-1.5 text-muted-foreground text-xs">
							<span className="tabular-nums">
								{fillMessage(t("channels.growthLine"), {
									count: signed.format(figures.netGrowth),
								})}
							</span>
							{figures.netGrowthChange === null ? null : (
								<ChangePill
									change={figures.netGrowthChange}
									goodWhen="up"
									comparison={t("channels.vsPrevious30")}
								/>
							)}
						</span>
					</div>
				</div>
				<DailyAreaChart
					points={summary.followerPoints}
					seriesLabel={t("channels.followersTrend")}
					variant="mini"
					color={CHANNEL_TONES[profile.id].color}
					className="h-14"
				/>
				<dl className="grid grid-cols-3 gap-3 border-border border-t pt-4 text-sm">
					<div className="grid gap-0.5">
						<dt className="text-muted-foreground text-xs">
							{t("metrics.engagementRateShort")}
						</dt>
						<dd className="tabular-nums">
							{rate.format(figures.engagementRate)}
						</dd>
					</div>
					<div className="grid gap-0.5">
						<dt className="text-muted-foreground text-xs">
							{t("channels.postCount")}
						</dt>
						<dd className="tabular-nums">{number.format(figures.posts)}</dd>
					</div>
					<div className="grid gap-0.5">
						<dt className="text-muted-foreground text-xs">
							{t("channels.avgImpressions")}
						</dt>
						<dd className="tabular-nums">
							{compact.format(figures.averageImpressions)}
						</dd>
					</div>
				</dl>
			</CardContent>
		</Card>
	);
}
