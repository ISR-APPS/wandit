// The page of one channel, on the layout of the kit "profile" page: the title and one action, Overview | Posts tabs,
// then a third column (profile card, weekly goal, formats) beside two thirds (latest activity, top posts, team).
// The /app/channels/$channelId route renders it after its loader. An unknown id shows a sentence and a link.
// The Posts tab lists every post of the channel from the post list query.
import {
	AtIcon,
	CalendarCheckIcon,
	CaretRightIcon,
	ClockIcon,
	NotePencilIcon,
	TargetIcon,
} from "@phosphor-icons/react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import { postsQueryOptions } from "~/features/posts";
import {
	CHANNEL_ICONS,
	ChannelMark,
	countForm,
	DAY_MS,
	fillMessage,
	formatRelativeTime,
	type Post,
	PostStatusBadge,
	rateFormat,
} from "~/features/social";
import { useT } from "~/shared/i18n";
import { Avatar, AvatarFallback } from "~/shared/ui/avatar";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";
import { type RecordColumn, RecordTable } from "~/shared/ui/record-table";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/shared/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { channelDetailQueryOptions } from "../api/channels.queries";

// The posts tab shows ten rows per page, as the post list.
const PAGE_SIZE = 10;

type ChannelDetailPageProps = {
	/** The id from the URL. Any text: an unknown id shows the not-found state. */
	channelId: string;
};

// Two letters of a person name for an avatar: "Inès Duarte" gives "ID".
function initialsOf(name: string): string {
	return name
		.split(" ")
		.map((part) => part.charAt(0))
		.join("")
		.slice(0, 2);
}

/** One column on a phone. From the 4xl container width, a third and two thirds. */
export function ChannelDetailPage({ channelId }: ChannelDetailPageProps) {
	const { t, locale } = useT();
	const { data: channel } = useSuspenseQuery(
		channelDetailQueryOptions(channelId),
	);
	// The Posts tab reads the post list. It loads in the background while the Overview tab shows.
	const posts = useQuery(postsQueryOptions());
	const [tab, setTab] = useState("overview");
	const now = Date.now();

	if (!channel) {
		return (
			<div className="grid justify-items-start gap-4">
				<h1 className="font-(--heading-weight) font-display text-2xl tracking-(--heading-tracking)">
					{t("channels.title")}
				</h1>
				<p role="alert">{t("channels.notFound")}</p>
				<Button asChild>
					<Link to="/app/channels">{t("channels.backToList")}</Link>
				</Button>
			</div>
		);
	}

	const number = new Intl.NumberFormat(locale);
	const compact = new Intl.NumberFormat(locale, {
		notation: "compact",
		maximumFractionDigits: 1,
	});
	const rate = rateFormat(locale);
	const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	const time = new Intl.DateTimeFormat(locale, { timeStyle: "short" });
	const name = t(`channels.names.${channel.id}`);
	const ChannelIcon = CHANNEL_ICONS[channel.id];
	// A week over the goal shows 100% and the "goal met" sentence: 200% of a weekly goal reads as an error.
	const isGoalMet = channel.postsThisWeek >= channel.profile.postsPerWeek;
	const goalPercent = Math.min(
		Math.round((channel.postsThisWeek / channel.profile.postsPerWeek) * 100),
		100,
	);
	const facts = [
		{ id: "handle", icon: AtIcon, text: channel.profile.handle },
		{
			id: "goal",
			icon: TargetIcon,
			text: fillMessage(
				t(
					`channels.goalLine.${countForm(locale, channel.profile.postsPerWeek)}`,
				),
				{
					goal: number.format(channel.profile.postsPerWeek),
				},
			),
		},
		{
			id: "hours",
			icon: ClockIcon,
			text: channel.profile.postingHours
				.map((hour) => time.format(new Date(2024, 0, 1, hour)))
				.join(", "),
		},
		{
			id: "connected",
			icon: CalendarCheckIcon,
			text: fillMessage(t("channels.connectedLine"), {
				date: dateFormat.format(
					new Date(now - channel.profile.connectedDaysAgo * DAY_MS),
				),
			}),
		},
		{
			id: "formats",
			icon: NotePencilIcon,
			text: channel.profile.formats
				.map((format) => t(`formats.${format}`))
				.join(", "),
		},
	];
	const channelPosts = (posts.data ?? []).filter(
		(post) => post.channelId === channel.id,
	);
	const dateTime = new Intl.DateTimeFormat(locale, {
		dateStyle: "medium",
		timeStyle: "short",
	});
	const postColumns: RecordColumn<Post>[] = [
		{
			id: "post",
			header: t("posts.post"),
			cell: (post) => (
				<Link
					to="/app/posts/$postId"
					params={{ postId: post.id }}
					className="line-clamp-1 max-w-96 font-medium hover:underline"
				>
					{post.title}
				</Link>
			),
		},
		{
			id: "date",
			header: t("posts.date"),
			cell: (post) =>
				post.publishAt
					? dateTime.format(new Date(post.publishAt))
					: t("posts.noSlot"),
			sortValue: (post) => Date.parse(post.publishAt ?? post.createdAt),
			hideable: true,
		},
		{
			id: "impressions",
			header: t("metrics.impressions"),
			cell: (post) => number.format(post.impressions),
			sortValue: (post) => post.impressions,
			align: "end",
			hideable: true,
		},
		{
			id: "status",
			header: t("posts.status"),
			cell: (post) => <PostStatusBadge status={post.status} />,
			hideable: true,
		},
	];

	return (
		<div className="grid gap-4">
			<PageHeader
				title={name}
				description={channel.profile.handle}
				actions={
					<Button asChild>
						<Link to="/app/posts">
							<NotePencilIcon />
							{t("channels.allPosts")}
						</Link>
					</Button>
				}
			/>
			<Tabs value={tab} onValueChange={setTab} className="gap-4">
				<TabsList>
					<TabsTrigger value="overview">
						{t("channels.tabOverview")}
					</TabsTrigger>
					<TabsTrigger value="posts">{t("channels.tabPosts")}</TabsTrigger>
				</TabsList>
				<TabsContent value="overview">
					<div className="grid @4xl/main:grid-cols-3 gap-4">
						<div className="grid content-start gap-4">
							<Card>
								<CardContent className="grid gap-12">
									<div className="flex flex-col items-center gap-4">
										<ChannelMark
											channelId={channel.id}
											className="size-20 rounded-full [&_svg]:size-9"
										/>
										<div className="text-center">
											<p className="flex items-center justify-center gap-2 font-semibold text-xl">
												{name}
												<Badge
													variant={
														channel.status === "active" ? "info" : "warning"
													}
												>
													{t(`channels.statuses.${channel.status}`)}
												</Badge>
											</p>
											<p className="text-muted-foreground text-sm">
												{channel.profile.handle}
											</p>
										</div>
									</div>
									<div className="grid grid-cols-3 divide-x rounded-md border bg-muted text-center *:py-3">
										<div>
											<p className="font-semibold text-lg tabular-nums">
												{number.format(channel.figures.posts)}
											</p>
											<p className="text-muted-foreground text-sm">
												{t("channels.postsShort")}
											</p>
										</div>
										<div>
											<p className="font-semibold text-lg tabular-nums">
												{compact.format(channel.figures.followers)}
											</p>
											<p className="text-muted-foreground text-sm">
												{t("metrics.followers")}
											</p>
										</div>
										<div>
											<p className="font-semibold text-lg tabular-nums">
												{rate.format(channel.figures.engagementRate)}
											</p>
											<p className="text-muted-foreground text-sm">
												{t("metrics.engagementRateShort")}
											</p>
										</div>
									</div>
									<ul className="flex flex-col gap-y-4">
										{facts.map((fact) => (
											<li
												key={fact.id}
												className="flex items-center gap-3 text-sm"
											>
												<fact.icon className="size-4 shrink-0 text-muted-foreground" />
												<span className="min-w-0 truncate">{fact.text}</span>
											</li>
										))}
									</ul>
								</CardContent>
							</Card>
							<Card>
								<CardHeader>
									<CardTitle>{t("channels.weeklyGoalTitle")}</CardTitle>
									<CardDescription>
										{fillMessage(
											isGoalMet
												? t(
														`channels.weeklyGoalMet.${countForm(locale, channel.postsThisWeek)}`,
													)
												: t(
														`channels.weeklyGoalDescription.${countForm(locale, channel.profile.postsPerWeek)}`,
													),
											{
												done: number.format(channel.postsThisWeek),
												goal: number.format(channel.profile.postsPerWeek),
											},
										)}
									</CardDescription>
								</CardHeader>
								<CardContent className="flex items-center gap-4">
									<Progress
										value={goalPercent}
										aria-label={t("channels.weeklyGoalTitle")}
									/>
									<span className="text-muted-foreground text-sm tabular-nums">
										{new Intl.NumberFormat(locale, { style: "percent" }).format(
											goalPercent / 100,
										)}
									</span>
								</CardContent>
							</Card>
							<Card>
								<CardHeader>
									<CardTitle>{t("channels.formatsTitle")}</CardTitle>
									<CardDescription>
										{t("channels.formatsDescription")}
									</CardDescription>
								</CardHeader>
								<CardContent>
									<ul className="flex flex-wrap gap-2">
										{channel.formats.map((score) => (
											<li key={score.format}>
												<Badge variant="outline">
													{t(`formats.${score.format}`)} ·{" "}
													<span className="tabular-nums">
														{score.posts === 0
															? "–"
															: rate.format(score.engagementRate)}
													</span>
												</Badge>
											</li>
										))}
									</ul>
								</CardContent>
							</Card>
						</div>

						<div className="@4xl/main:col-span-2 grid content-start gap-4">
							<Card>
								<CardHeader>
									<CardTitle>{t("channels.activityTitle")}</CardTitle>
									<CardAction>
										<button
											type="button"
											onClick={() => setTab("posts")}
											className="text-muted-foreground text-sm hover:text-foreground hover:underline"
										>
											{t("channels.viewAll")}
										</button>
									</CardAction>
								</CardHeader>
								<CardContent className="ps-8">
									{channel.latest.length === 0 ? (
										<p className="text-muted-foreground text-sm">
											{t("channels.noActivity")}
										</p>
									) : (
										<ol className="relative border-s">
											{channel.latest.map((post, index) => (
												<li
													key={post.id}
													className="ms-6 grid gap-2 pb-10 last:pb-0"
												>
													<span className="absolute -start-3 flex size-6 items-center justify-center rounded-full border bg-muted">
														<ChannelIcon className="size-3 text-primary" />
													</span>
													<h3 className="flex flex-wrap items-center gap-2 font-semibold">
														<Link
															to="/app/posts/$postId"
															params={{ postId: post.id }}
															className="hover:underline"
														>
															{post.title}
														</Link>
														{index === 0 ? (
															<Badge variant="outline">
																{t("channels.latest")}
															</Badge>
														) : null}
													</h3>
													<time
														dateTime={post.publishAt ?? post.createdAt}
														className="flex items-center gap-1.5 text-muted-foreground text-sm leading-none"
													>
														<ClockIcon className="size-3" />
														{formatRelativeTime(
															post.publishAt ?? post.createdAt,
															now,
															locale,
														)}{" "}
														· {t(`posts.statuses.${post.status}`)}
													</time>
													<p className="text-muted-foreground text-sm">
														{post.caption}
													</p>
													{index === 0 ? (
														<Button
															variant="outline"
															className="justify-self-start"
															asChild
														>
															<Link
																to="/app/posts/$postId"
																params={{ postId: post.id }}
															>
																{t("posts.open")}
															</Link>
														</Button>
													) : null}
												</li>
											))}
										</ol>
									)}
								</CardContent>
							</Card>
							<div className="grid @4xl/main:grid-cols-2 gap-4">
								<Card>
									<CardHeader>
										<CardTitle>{t("channels.topPostsTitle")}</CardTitle>
									</CardHeader>
									<CardContent>
										{channel.topPosts.length === 0 ? (
											<p className="text-muted-foreground text-sm">
												{t("channels.noTopPosts")}
											</p>
										) : (
											<Table>
												<TableHeader>
													<TableRow>
														<TableHead>{t("posts.post")}</TableHead>
														<TableHead className="text-end">
															{t("metrics.impressionsShort")}
														</TableHead>
													</TableRow>
												</TableHeader>
												<TableBody>
													{channel.topPosts.map((post) => (
														<TableRow key={post.id}>
															{/* max-w-0 with w-full gives the title the free width. A long title wraps, so no word is hidden. */}
															<TableCell className="w-full max-w-0">
																<Link
																	to="/app/posts/$postId"
																	params={{ postId: post.id }}
																	className="block whitespace-normal hover:underline"
																>
																	{post.title}
																</Link>
															</TableCell>
															<TableCell className="text-end tabular-nums">
																{compact.format(post.impressions)}
															</TableCell>
														</TableRow>
													))}
												</TableBody>
											</Table>
										)}
									</CardContent>
								</Card>
								<Card>
									<CardHeader>
										<CardTitle>{t("channels.teamTitle")}</CardTitle>
										<CardAction>
											<Button
												variant="outline"
												size="icon"
												asChild
												aria-label={t("channels.allPosts")}
											>
												<Link to="/app/posts">
													<CaretRightIcon className="rtl:rotate-180" />
												</Link>
											</Button>
										</CardAction>
									</CardHeader>
									<CardContent>
										<ul className="grid gap-4">
											{channel.team.map((member) => (
												<li
													key={member.name}
													className="flex items-center justify-between gap-3"
												>
													<div className="flex min-w-0 items-center gap-4">
														<Avatar>
															<AvatarFallback className="bg-muted">
																{initialsOf(member.name)}
															</AvatarFallback>
														</Avatar>
														<div className="grid min-w-0">
															<span className="truncate font-medium">
																{member.name}
															</span>
															<span className="truncate text-muted-foreground text-xs">
																{t("channels.teamRole")}
															</span>
														</div>
													</div>
													<Badge
														variant={member.posts > 0 ? "default" : "outline"}
														className="tabular-nums"
													>
														{fillMessage(
															t(
																`channels.postCount.${countForm(locale, member.posts)}`,
															),
															{
																count: number.format(member.posts),
															},
														)}
													</Badge>
												</li>
											))}
										</ul>
									</CardContent>
								</Card>
							</div>
						</div>
					</div>
				</TabsContent>
				<TabsContent value="posts">
					{posts.isError ? (
						<p role="alert">{t("posts.loadError")}</p>
					) : posts.isPending ? (
						<Skeleton className="h-96 w-full" />
					) : (
						<RecordTable
							rows={channelPosts}
							columns={postColumns}
							searchText={(post) => `${post.title} ${post.caption}`}
							searchPlaceholder={t("posts.searchPlaceholder")}
							pageSize={PAGE_SIZE}
							noResults={t("posts.noResults")}
						/>
					)}
				</TabsContent>
			</Tabs>
		</div>
	);
}

/** Loading state of the channel page: the header, the tabs, and the two columns. */
export function ChannelDetailPageSkeleton() {
	return (
		<div className="grid gap-4">
			<Skeleton className="h-8 w-48" />
			<Skeleton className="h-9 w-48" />
			<div className="grid @4xl/main:grid-cols-3 gap-4">
				<Skeleton className="h-128" />
				<Skeleton className="@4xl/main:col-span-2 h-128" />
			</div>
		</div>
	);
}
