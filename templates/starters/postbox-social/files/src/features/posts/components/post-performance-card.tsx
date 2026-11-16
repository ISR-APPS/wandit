// The numbers of one post: impressions and engagement rate against the channel average, the reactions, and the build-up by day.
// PostDetailPage renders it in the main column. A post that is not live shows why it has no numbers yet.
import {
	BookmarkSimpleIcon,
	ChatCircleIcon,
	CursorClickIcon,
	HeartIcon,
	ShareFatIcon,
	WarningCircleIcon,
} from "@phosphor-icons/react";
import {
	ChangePill,
	DAY_MS,
	fillMessage,
	formatRelativeTime,
	rateFormat,
	ShareBar,
} from "~/features/social";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import type { PostDetail } from "../api/posts.queries";

type PostPerformanceCardProps = {
	/** The post and its channel average, from postQueryOptions. */
	detail: PostDetail;
};

/** Reactions of a published post, in the order that the networks show them. */
const REACTIONS = [
	{ key: "likes", icon: HeartIcon },
	{ key: "comments", icon: ChatCircleIcon },
	{ key: "shares", icon: ShareFatIcon },
	{ key: "saves", icon: BookmarkSimpleIcon },
	{ key: "clicks", icon: CursorClickIcon },
] as const;

/** A published post gets its numbers. A scheduled, draft, or failed post gets one sentence in the same frame. */
export function PostPerformanceCard({ detail }: PostPerformanceCardProps) {
	const { t, locale } = useT();
	const { post, channelAverage } = detail;
	const number = new Intl.NumberFormat(locale);
	const rate = rateFormat(locale);
	const dayFormat = new Intl.DateTimeFormat(locale, {
		weekday: "short",
		day: "numeric",
		month: "short",
	});

	if (post.status !== "published") {
		const now = Date.now();
		const message =
			post.status === "failed"
				? t(`posts.failures.${post.failureReason ?? "unknown"}`)
				: post.status === "scheduled" && post.publishAt
					? fillMessage(t("posts.waitingScheduled"), {
							when: formatRelativeTime(post.publishAt, now, locale),
						})
					: t("posts.waitingDraft");
		return (
			<Card>
				<CardHeader>
					<CardTitle>{t("posts.performance")}</CardTitle>
				</CardHeader>
				<CardContent>
					{post.status === "failed" ? (
						<p
							className="flex items-start gap-2 rounded-control border border-destructive/30 bg-destructive/10 p-3 text-sm"
							role="alert"
						>
							<WarningCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
							{message}
						</p>
					) : (
						<p className="text-muted-foreground text-sm">{message}</p>
					)}
				</CardContent>
			</Card>
		);
	}

	const engagementRate =
		post.impressions === 0 ? 0 : post.engagements / post.impressions;
	const impressionsChange =
		channelAverage.impressions === 0
			? null
			: (post.impressions - channelAverage.impressions) /
				channelAverage.impressions;
	const rateChange =
		channelAverage.engagementRate === 0
			? null
			: (engagementRate - channelAverage.engagementRate) /
				channelAverage.engagementRate;
	const largestDay = Math.max(...post.impressionsByDay, 1);
	const publishDay = post.publishAt ? Date.parse(post.publishAt) : 0;
	// A post earns impressions for four days. A younger post shows the days so far.
	const isGrowing = post.impressionsByDay.length < 4;

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("posts.performance")}</CardTitle>
				<CardDescription>
					{t(isGrowing ? "posts.performanceGrowing" : "posts.performanceFinal")}
				</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-6">
				<div className="grid @xl/main:grid-cols-2 gap-4">
					<HeadlineFigure
						label={t("metrics.impressions")}
						value={number.format(post.impressions)}
						change={impressionsChange}
						comparison={t("posts.vsChannelAverage")}
						note={fillMessage(t("posts.channelAverage"), {
							value: number.format(channelAverage.impressions),
						})}
					/>
					<HeadlineFigure
						label={t("metrics.engagementRate")}
						value={rate.format(engagementRate)}
						change={rateChange}
						comparison={t("posts.vsChannelAverage")}
						note={fillMessage(t("posts.channelAverage"), {
							value: rate.format(channelAverage.engagementRate),
						})}
					/>
				</div>
				<dl className="grid @xl/main:grid-cols-5 grid-cols-2 gap-3">
					{REACTIONS.map((reaction) => (
						<div
							key={reaction.key}
							className="grid gap-1 rounded-control bg-muted/50 px-3 py-2.5 @xl/main:last:col-span-1 last:col-span-2"
						>
							<dt className="flex items-center gap-1.5 text-muted-foreground text-xs">
								<reaction.icon className="size-3.5" />
								{t(`posts.reactions.${reaction.key}`)}
							</dt>
							<dd className="font-numeric text-lg tabular-nums">
								{number.format(post[reaction.key])}
							</dd>
						</div>
					))}
				</dl>
				<div className="grid gap-3">
					<p className="font-medium text-sm">{t("posts.byDay")}</p>
					<ol className="grid gap-2.5">
						{post.impressionsByDay.map((impressions, index) => (
							<li
								// biome-ignore lint/suspicious/noArrayIndexKey: the days of a post never reorder.
								key={index}
								className="grid grid-cols-[5.5rem_1fr_4.5rem] items-center gap-3 text-sm"
							>
								<span className="text-muted-foreground">
									{dayFormat.format(new Date(publishDay + index * DAY_MS))}
								</span>
								<ShareBar share={impressions / largestDay} />
								<span className="text-end tabular-nums">
									{number.format(impressions)}
								</span>
							</li>
						))}
					</ol>
				</div>
			</CardContent>
		</Card>
	);
}

type HeadlineFigureProps = {
	label: string;
	/** The formatted value. */
	value: string;
	/** Ratio against the channel average. null hides the pill. */
	change: number | null;
	/** The muted line with the channel average. */
	note: string;
	/** Screen reader text after the percent of the pill. */
	comparison: string;
};

// One large figure of the card with its pill against the channel average.
function HeadlineFigure({
	label,
	value,
	change,
	note,
	comparison,
}: HeadlineFigureProps) {
	return (
		<div className="grid gap-1.5 rounded-control border border-border p-4">
			<span className="label-text text-muted-foreground text-sm">{label}</span>
			<span className="flex flex-wrap items-center gap-2">
				<span className="font-numeric text-3xl tabular-nums">{value}</span>
				{change === null ? null : (
					<ChangePill change={change} goodWhen="up" comparison={comparison} />
				)}
			</span>
			<span className="text-muted-foreground text-xs">{note}</span>
		</div>
	);
}
