// The page of one post, on the three-column layout of the kit "social media" app:
// a channel card (a filter of the feed, the status counts) and a facts card at the start, the feed in the middle (the channels row, the post, other posts of its channel),
// and two list cards at the end (performance, and posts of the same pillar).
// The /app/posts/$postId route renders it after its loader. An unknown id shows a sentence and a link to the list.
import {
	CalendarDotsIcon,
	CheckCircleIcon,
	ClockIcon,
	CursorClickIcon,
	EyeIcon,
	GearSixIcon,
	HeartIcon,
	NotePencilIcon,
	PlusIcon,
	ShareFatIcon,
	WarningCircleIcon,
} from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
	CHANNEL_IDS,
	ChannelMark,
	channelProfile,
	fillMessage,
	POST_STATUSES,
	type PostStatus,
	rateFormat,
} from "~/features/social";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { type KitIcon, MagnifyingGlassIcon } from "~/shared/ui/icons";
import { Input } from "~/shared/ui/input";
import { Skeleton } from "~/shared/ui/skeleton";
import { postQueryOptions } from "../api/posts.queries";
import { PostItem } from "./post-item";

// The icon of each status row of the channel card.
const STATUS_ICONS = {
	published: CheckCircleIcon,
	scheduled: ClockIcon,
	draft: NotePencilIcon,
	failed: WarningCircleIcon,
} satisfies Record<PostStatus, KitIcon>;

type PostDetailPageProps = {
	/** The id from the URL. Any text: an unknown id shows the not-found state. */
	postId: string;
};

/** One column on a phone, the feed beside the channel card from 3xl, and the end column from 5xl. */
export function PostDetailPage({ postId }: PostDetailPageProps) {
	const { t, locale } = useT();
	const { data: detail } = useSuspenseQuery(postQueryOptions(postId));
	// Text of the filter field in the channel card. It narrows the other posts of the channel under the current post.
	const [feedQuery, setFeedQuery] = useState("");
	const now = Date.now();

	if (!detail) {
		return (
			<div className="grid justify-items-start gap-4">
				<h1 className="font-(--heading-weight) font-display text-2xl tracking-(--heading-tracking)">
					{t("posts.title")}
				</h1>
				<p role="alert">{t("posts.notFound")}</p>
				<Button asChild>
					<Link to="/app/posts">{t("posts.backToList")}</Link>
				</Button>
			</div>
		);
	}

	const { post, channelAverage, related, sameChannel, channelCounts } = detail;
	const profile = channelProfile(post.channelId);
	const number = new Intl.NumberFormat(locale);
	const rate = rateFormat(locale);
	const dateTime = new Intl.DateTimeFormat(locale, {
		dateStyle: "medium",
		timeStyle: "short",
	});
	const needle = feedQuery.trim().toLocaleLowerCase(locale);
	const feedPosts = needle
		? sameChannel.filter((row) =>
				`${row.title} ${row.caption}`
					.toLocaleLowerCase(locale)
					.includes(needle),
			)
		: sameChannel;
	const postRate =
		post.impressions === 0 ? 0 : post.engagements / post.impressions;
	const performance = [
		{
			id: "impressions",
			icon: EyeIcon,
			label: t("metrics.impressions"),
			detail: fillMessage(t("posts.channelAverage"), {
				value: number.format(channelAverage.impressions),
			}),
			value: number.format(post.impressions),
		},
		{
			id: "rate",
			icon: HeartIcon,
			label: t("metrics.engagementRate"),
			detail: fillMessage(t("posts.channelAverage"), {
				value: rate.format(channelAverage.engagementRate),
			}),
			value: rate.format(postRate),
		},
		{
			id: "shares",
			icon: ShareFatIcon,
			label: t("posts.reactions.shares"),
			detail: t("posts.sharesDetail"),
			value: number.format(post.shares),
		},
		{
			id: "clicks",
			icon: CursorClickIcon,
			label: t("posts.reactions.clicks"),
			detail: t("posts.clicksDetail"),
			value: number.format(post.clicks),
		},
	];
	const facts = [
		{ label: t("posts.pillar"), value: t(`pillars.${post.pillar}`) },
		{ label: t("posts.format"), value: t(`formats.${post.format}`) },
		{ label: t("posts.author"), value: post.author },
		{
			label: t("posts.approver"),
			value: post.approver || t("posts.notApproved"),
		},
		{
			label: t("posts.date"),
			value: post.publishAt
				? dateTime.format(new Date(post.publishAt))
				: t("posts.noSlot"),
		},
	];

	return (
		<div className="grid @3xl/main:grid-cols-[17.5rem_minmax(0,1fr)] @5xl/main:grid-cols-[17.5rem_minmax(0,1fr)_17.5rem] grid-cols-1 gap-4">
			<h1 className="sr-only">{post.title}</h1>
			<aside className="grid content-start gap-4">
				<Card className="bg-muted">
					<CardHeader className="flex items-center gap-3">
						<ChannelMark
							channelId={post.channelId}
							className="size-10 rounded-full"
						/>
						<div className="grid min-w-0">
							<span className="truncate text-sm">
								{t(`channels.names.${post.channelId}`)}
							</span>
							<span className="truncate text-muted-foreground text-xs">
								{profile.handle}
							</span>
						</div>
						<Button
							variant="ghost"
							size="icon"
							className="ms-auto"
							asChild
							aria-label={t("posts.openChannel")}
						>
							<Link
								to="/app/channels/$channelId"
								params={{ channelId: post.channelId }}
							>
								<GearSixIcon />
							</Link>
						</Button>
					</CardHeader>
					<CardContent className="grid gap-4">
						<div className="relative">
							<MagnifyingGlassIcon className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								type="search"
								value={feedQuery}
								onChange={(event) => setFeedQuery(event.target.value)}
								placeholder={t("posts.filterFeed")}
								aria-label={t("posts.filterFeed")}
								className="bg-background ps-9"
							/>
						</div>
						<ul className="grid gap-1">
							{POST_STATUSES.map((status) => {
								const Icon = STATUS_ICONS[status];
								const isCurrent = status === post.status;
								return (
									<li
										key={status}
										aria-current={isCurrent ? "true" : undefined}
										className={cn(
											"flex items-center justify-between rounded-control px-3 py-2.5 text-sm",
											isCurrent
												? "bg-background font-medium"
												: "text-muted-foreground",
										)}
									>
										<span className="flex items-center gap-3">
											<Icon className="size-4" />
											{t(`posts.statuses.${status}`)}
										</span>
										<Badge
											variant="secondary"
											className="h-5 min-w-5 justify-center rounded-full px-1.5 tabular-nums"
										>
											{number.format(channelCounts[status])}
										</Badge>
									</li>
								);
							})}
						</ul>
						<Button variant="outline" className="w-full bg-background" asChild>
							<Link to="/app/schedule">
								<CalendarDotsIcon />
								{t("posts.openSchedule")}
							</Link>
						</Button>
					</CardContent>
				</Card>
				<Card className="bg-muted">
					<CardHeader>
						<CardTitle>{t("posts.factsTitle")}</CardTitle>
					</CardHeader>
					<CardContent>
						<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
							{facts.map((fact) => (
								<div key={fact.label} className="contents">
									<dt className="text-muted-foreground">{fact.label}</dt>
									<dd className="min-w-0 text-end">{fact.value}</dd>
								</div>
							))}
						</dl>
					</CardContent>
				</Card>
			</aside>

			{/* grid-cols-1 caps the track at the column width, so the channels row scrolls and does not widen the page. */}
			<div className="grid min-w-0 grid-cols-1 content-start gap-4">
				<nav aria-label={t("channels.title")}>
					<ul className="flex gap-1 overflow-x-auto py-1.5">
						<li>
							<Link
								to="/app/schedule"
								className="group flex flex-col items-center gap-2 px-2"
							>
								<span className="flex size-14 items-center justify-center rounded-full bg-muted ring-2 ring-muted group-hover:ring-primary/20">
									<PlusIcon className="size-5 opacity-60" />
								</span>
								<span className="max-w-16 truncate text-muted-foreground text-xs">
									{t("posts.plan")}
								</span>
							</Link>
						</li>
						{CHANNEL_IDS.map((channelId) => (
							<li key={channelId}>
								<Link
									to="/app/channels/$channelId"
									params={{ channelId }}
									className="flex flex-col items-center gap-2 px-2 hover:opacity-80"
								>
									<ChannelMark
										channelId={channelId}
										size="lg"
										className={cn(
											"size-14 rounded-full ring-2 ring-offset-2 ring-offset-background",
											channelId === post.channelId
												? "ring-primary"
												: "ring-border",
										)}
									/>
									<span className="max-w-16 text-center text-muted-foreground text-xs">
										{t(`channels.names.${channelId}`)}
									</span>
								</Link>
							</li>
						))}
					</ul>
				</nav>
				<PostItem post={post} now={now} isCurrent />
				{feedPosts.map((row) => (
					<PostItem key={row.id} post={row} now={now} />
				))}
				{needle && feedPosts.length === 0 ? (
					<p className="text-center text-muted-foreground text-sm">
						{t("posts.noResults")}
					</p>
				) : null}
				<div className="text-center">
					<Button variant="outline" asChild>
						<Link to="/app/posts">{t("posts.morePosts")}</Link>
					</Button>
				</div>
			</div>

			<aside className="@3xl/main:col-span-2 @5xl/main:col-span-1 grid content-start gap-4">
				<Card className="bg-muted">
					<CardHeader>
						<CardTitle>{t("posts.performance")}</CardTitle>
						<CardAction>
							<Button
								variant="link"
								size="sm"
								className="font-normal text-xs"
								asChild
							>
								<Link
									to="/app/channels/$channelId"
									params={{ channelId: post.channelId }}
								>
									{t("posts.seeAll")}
								</Link>
							</Button>
						</CardAction>
					</CardHeader>
					<CardContent>
						<ul className="grid gap-3">
							{performance.map((row) => (
								<li key={row.id} className="flex items-center gap-3">
									<span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-background">
										<row.icon className="size-4" />
									</span>
									<div className="grid min-w-0">
										<span className="truncate font-medium text-sm">
											{row.label}
										</span>
										<span className="text-pretty text-muted-foreground text-xs">
											{row.detail}
										</span>
									</div>
									<span className="ms-auto shrink-0 text-sm tabular-nums">
										{row.value}
									</span>
								</li>
							))}
						</ul>
					</CardContent>
				</Card>
				<Card className="bg-muted">
					<CardHeader>
						<CardTitle>
							{fillMessage(t("posts.related"), {
								pillar: t(`pillars.${post.pillar}`),
							})}
						</CardTitle>
						<CardAction>
							<Button
								variant="link"
								size="sm"
								className="font-normal text-xs"
								asChild
							>
								<Link to="/app/posts">{t("posts.seeAll")}</Link>
							</Button>
						</CardAction>
					</CardHeader>
					<CardContent>
						{related.length === 0 ? (
							<p className="text-muted-foreground text-sm">
								{t("posts.noRelated")}
							</p>
						) : (
							<ul className="grid gap-3">
								{related.map((row) => (
									<li key={row.id} className="flex items-center gap-3">
										<ChannelMark
											channelId={row.channelId}
											className="rounded-full"
										/>
										<div className="grid min-w-0">
											<Link
												to="/app/posts/$postId"
												params={{ postId: row.id }}
												className="line-clamp-2 font-medium text-sm hover:underline"
											>
												{row.title}
											</Link>
											<span className="truncate text-muted-foreground text-xs">
												{channelProfile(row.channelId).handle}
											</span>
										</div>
									</li>
								))}
							</ul>
						)}
					</CardContent>
				</Card>
			</aside>
		</div>
	);
}

/** Loading state of the post page: the three columns. */
export function PostDetailPageSkeleton() {
	return (
		<div className="grid @3xl/main:grid-cols-[17.5rem_minmax(0,1fr)] @5xl/main:grid-cols-[17.5rem_minmax(0,1fr)_17.5rem] grid-cols-1 gap-4">
			<Skeleton className="h-96" />
			<div className="grid content-start gap-4">
				<Skeleton className="h-20" />
				<Skeleton className="h-144" />
			</div>
			<Skeleton className="@5xl/main:block hidden h-96" />
		</div>
	);
}
