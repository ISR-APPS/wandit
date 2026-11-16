// The page of one channel: the period figures, impressions per day, the top posts, the formats, and the account facts.
// The /app/channels/$channelId route renders it after its loader. The route also uses the skeleton below.
// The period tabs change the figures, the trend, and the top posts. An unknown id shows a not-found block.
import {
	keepPreviousData,
	useQuery,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	CHANNEL_TONES,
	ChannelMark,
	DAY_MS,
	DailyAreaChart,
	DEFAULT_DAYS,
	dayCountFormat,
	fillMessage,
	type PeriodDays,
	PeriodTabs,
	TOUCH_AREA,
} from "~/features/social";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { CaretLeftIcon } from "~/shared/ui/icons";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	channelPeriodQueryOptions,
	channelQueryOptions,
} from "../api/channels.queries";
import { ChannelFiguresStrip } from "./channel-figures-strip";
import { ChannelFormatsCard } from "./channel-formats-card";
import { ChannelTopPostsCard } from "./channel-top-posts-card";

type ChannelDetailPageProps = {
	/** The `$channelId` param of the URL, for example "photo". */
	channelId: string;
};

/** A 2/3 main column and a 1/3 rail from the 5xl container width. */
export function ChannelDetailPage({ channelId }: ChannelDetailPageProps) {
	const { t, locale } = useT();
	const [days, setDays] = useState<PeriodDays>(DEFAULT_DAYS);
	const { data: channel } = useSuspenseQuery(channelQueryOptions(channelId));
	const period = useQuery({
		...channelPeriodQueryOptions(channelId, days),
		placeholderData: keepPreviousData,
	});

	const backLink = (
		<Button
			asChild
			variant="ghost"
			size="sm"
			className={cn("-ms-3 justify-self-start", TOUCH_AREA)}
		>
			<Link to="/app/channels">
				<CaretLeftIcon className="rtl:rotate-180" />
				{t("channels.title")}
			</Link>
		</Button>
	);
	if (!channel) {
		return (
			<div className="grid gap-4">
				{backLink}
				<p className="text-muted-foreground text-sm">
					{t("channels.notFound")}
				</p>
			</div>
		);
	}

	const { profile, formats } = channel;
	const number = new Intl.NumberFormat(locale);
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	const hour = new Intl.DateTimeFormat(locale, { hour: "numeric" });
	const name = t(`channels.names.${profile.id}`);
	// The connection date is a fixed number of days before today.
	const connectedAt = Date.now() - profile.connectedDaysAgo * DAY_MS;

	return (
		<div className="grid gap-6">
			{backLink}
			<PageHeader
				title={name}
				description={
					<span className="flex flex-wrap items-center gap-2">
						<ChannelMark channelId={profile.id} size="sm" />
						<bdi>{profile.handle}</bdi>
						{/* The period text wraps under the handle on a narrow page. The dot then hides, so no line ends on it. */}
						<span aria-hidden="true" className="@2xl/main:inline hidden">
							·
						</span>
						{fillMessage(t("channels.periodLine"), {
							period: dayCountFormat(locale).format(days),
						})}
					</span>
				}
				actions={<PeriodTabs days={days} onDaysChange={setDays} />}
			/>
			{period.isError ? null : period.data ? (
				<ChannelFiguresStrip figures={period.data.figures} />
			) : (
				<Skeleton className="h-32" />
			)}
			<div className="grid @5xl/main:grid-cols-3 items-start gap-6">
				{/* A failed period read replaces the period panels with one error card. The rail does not follow the period. */}
				{period.isError ? (
					<Card className="@5xl/main:col-span-2">
						<CardContent className="grid justify-items-start gap-3">
							<p role="alert" className="text-sm">
								{t("channels.periodLoadError")}
							</p>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => period.refetch()}
							>
								{t("common.retry")}
							</Button>
						</CardContent>
					</Card>
				) : (
					<div className="@5xl/main:col-span-2 grid gap-6">
						<Card>
							<CardHeader>
								<CardTitle>{t("channels.trendTitle")}</CardTitle>
								<CardDescription>
									{t("overview.trendDescription")}
								</CardDescription>
							</CardHeader>
							<CardContent>
								{period.data ? (
									<DailyAreaChart
										points={period.data.impressions}
										seriesLabel={t("metrics.impressions")}
										color={CHANNEL_TONES[profile.id].color}
										className="h-72"
									/>
								) : (
									<Skeleton className="h-72" />
								)}
							</CardContent>
						</Card>
						{period.data ? (
							<ChannelTopPostsCard posts={period.data.topPosts} />
						) : (
							<Skeleton className="h-72" />
						)}
					</div>
				)}
				<div className="grid gap-6">
					<ChannelFormatsCard channelId={profile.id} formats={formats} />
					<Card>
						<CardHeader>
							<CardTitle>{t("channels.accountTitle")}</CardTitle>
						</CardHeader>
						<CardContent>
							<dl className="grid gap-4 text-sm">
								<div className="flex justify-between gap-4">
									<dt className="text-muted-foreground">
										{t("channels.handle")}
									</dt>
									<dd>
										<bdi>{profile.handle}</bdi>
									</dd>
								</div>
								<div className="flex justify-between gap-4">
									<dt className="text-muted-foreground">
										{t("metrics.followers")}
									</dt>
									<dd className="tabular-nums">
										{number.format(profile.followers)}
									</dd>
								</div>
								<div className="flex justify-between gap-4">
									<dt className="text-muted-foreground">
										{t("channels.weeklyGoalLabel")}
									</dt>
									<dd className="tabular-nums">
										{fillMessage(t("channels.weeklyGoalValue"), {
											goal: number.format(profile.postsPerWeek),
										})}
									</dd>
								</div>
								<div className="flex justify-between gap-4">
									<dt className="text-muted-foreground">
										{t("channels.postingHours")}
									</dt>
									<dd className="text-end tabular-nums">
										{profile.postingHours
											.map((value) => hour.format(new Date(2000, 0, 1, value)))
											.join(", ")}
									</dd>
								</div>
								<div className="flex justify-between gap-4">
									<dt className="text-muted-foreground">
										{t("channels.connectedSince")}
									</dt>
									<dd className="tabular-nums">{date.format(connectedAt)}</dd>
								</div>
							</dl>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}

/** Placeholder while the detail loader runs. The route sets it as pendingComponent. */
export function ChannelDetailPageSkeleton() {
	return (
		<div className="grid gap-6">
			<Skeleton className="h-8 w-28" />
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-48" />
					<Skeleton className="h-5 w-72 max-w-full" />
				</div>
				<Skeleton className="h-9 w-64" />
			</div>
			<Skeleton className="h-32" />
			<div className="grid @5xl/main:grid-cols-3 items-start gap-6">
				<Skeleton className="@5xl/main:col-span-2 h-96" />
				<Skeleton className="h-96" />
			</div>
		</div>
	);
}
