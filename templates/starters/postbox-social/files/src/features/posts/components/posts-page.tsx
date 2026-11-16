// The post list behind login: the status tabs, a channel filter, and the searchable table.
// The /app/posts route renders it after its loader. The route also uses the skeleton and the error below.
// The channel filter runs first, so each tab count equals the rows that the tab shows.
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	CHANNEL_IDS,
	type ChannelId,
	ChannelMark,
	LoadError,
	POST_STATUSES,
	type Post,
	type PostStatus,
	PostStatusBadge,
	rateFormat,
	TAB_TOUCH_AREA,
	TOUCH_AREA,
} from "~/features/social";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Card, CardContent } from "~/shared/ui/card";
import { DataTable, type DataTableColumn } from "~/shared/ui/data-table";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { postsQueryOptions } from "../api/posts.queries";

/** The list page. The channel Select and the status tab filter the rows; then DataTable searches, sorts, and pages them. */
export function PostsPage() {
	const { t, locale } = useT();
	const { data: posts } = useSuspenseQuery(postsQueryOptions());
	// The list opens on the published posts: they have numbers. The queue has its own tab and the Schedule page.
	const [status, setStatus] = useState<PostStatus | "all">("published");
	const [channel, setChannel] = useState<ChannelId | "all">("all");

	const number = new Intl.NumberFormat(locale);
	const rate = rateFormat(locale);
	const day = new Intl.DateTimeFormat(locale, {
		month: "short",
		day: "numeric",
	});
	const time = new Intl.DateTimeFormat(locale, {
		hour: "numeric",
		minute: "2-digit",
	});
	const channelPosts =
		channel === "all"
			? posts
			: posts.filter((row) => row.channelId === channel);
	// A tab shows only for a status that has rows under the chosen channel.
	const tabs = POST_STATUSES.map((value) => ({
		value,
		count: channelPosts.filter((row) => row.status === value).length,
	})).filter((tab) => tab.count > 0);
	// A channel change can empty the chosen tab. Its tab then disappears, so the list shows all rows.
	const activeStatus = tabs.some((tab) => tab.value === status)
		? status
		: "all";
	const rows =
		activeStatus === "all"
			? channelPosts
			: channelPosts.filter((row) => row.status === activeStatus);
	const hasNumbers = (row: Post) => row.status === "published";

	const columns: DataTableColumn<Post>[] = [
		{
			id: "post",
			header: t("posts.post"),
			sortValue: (row) => row.title,
			// The channel mark and name sit in this cell, so the table needs no channel column and fits a 1024 px screen.
			// A fixed track under the 5xl container width keeps the table inside its card, so a long title truncates.
			// The track is narrower on a phone, so the status stays in view next to the title.
			// justify-items-start: each line is as wide as its text. Then dir="auto" text sits at the start side in Arabic too.
			cell: (row) => (
				<div className="flex @5xl/main:w-auto @xl/main:w-60 w-48 @5xl/main:max-w-md items-center gap-3">
					<ChannelMark channelId={row.channelId} size="sm" />
					<div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)] justify-items-start gap-0.5">
						<Link
							to="/app/posts/$postId"
							params={{ postId: row.id }}
							className={cn(
								"max-w-full font-medium hover:underline",
								TOUCH_AREA,
							)}
							dir="auto"
						>
							<span className="block truncate">{row.title}</span>
						</Link>
						<span className="max-w-full truncate text-muted-foreground text-xs">
							{`${t(`channels.names.${row.channelId}`)} · ${t(`formats.${row.format}`)}`}
						</span>
					</div>
				</div>
			),
		},
		{
			id: "status",
			header: t("posts.status"),
			sortValue: (row) => POST_STATUSES.indexOf(row.status),
			cell: (row) => <PostStatusBadge status={row.status} />,
		},
		{
			id: "date",
			header: t("posts.date"),
			sortValue: (row) => Date.parse(row.publishAt ?? row.createdAt),
			// The day and the time on two lines, the same height as the post cell, so the column stays narrow.
			cell: (row) =>
				row.publishAt ? (
					<span className="grid whitespace-nowrap tabular-nums">
						<span>{day.format(new Date(row.publishAt))}</span>
						<span className="text-muted-foreground text-xs">
							{time.format(new Date(row.publishAt))}
						</span>
					</span>
				) : (
					<span className="block whitespace-normal text-muted-foreground">
						{t("posts.noSlot")}
					</span>
				),
		},
		{
			id: "impressions",
			header: t("metrics.impressions"),
			align: "end",
			sortValue: (row) => row.impressions,
			cell: (row) =>
				hasNumbers(row) ? (
					number.format(row.impressions)
				) : (
					<span className="text-muted-foreground">–</span>
				),
		},
		{
			id: "rate",
			header: t("metrics.engagementRateShort"),
			align: "end",
			sortValue: (row) =>
				row.impressions === 0 ? -1 : row.engagements / row.impressions,
			cell: (row) =>
				hasNumbers(row) && row.impressions > 0 ? (
					rate.format(row.engagements / row.impressions)
				) : (
					<span className="text-muted-foreground">–</span>
				),
		},
	];

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("posts.title")}
				description={t("posts.description")}
			/>
			<Card>
				<CardContent>
					<DataTable
						rows={rows}
						columns={columns}
						searchText={(row) =>
							`${row.title} ${row.caption} ${row.hashtags.join(" ")} ${row.author}`
						}
						noResults={t("posts.noResults")}
						toolbar={
							<>
								<Select
									value={channel}
									onValueChange={(value) =>
										setChannel(
											CHANNEL_IDS.find((option) => option === value) ?? "all",
										)
									}
								>
									<SelectTrigger
										className="@xl/main:w-44 w-full"
										aria-label={t("posts.channelFilter")}
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">
											{t("posts.allChannels")}
										</SelectItem>
										{CHANNEL_IDS.map((id) => (
											<SelectItem key={id} value={id}>
												{t(`channels.names.${id}`)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<Tabs
									value={activeStatus}
									onValueChange={(value) =>
										setStatus(
											POST_STATUSES.find((option) => option === value) ?? "all",
										)
									}
									className="max-w-full"
								>
									{/* A narrow main area wraps the tabs, so every status stays in view. The "!" wins over the kit h-9. */}
									<TabsList className="@max-xl/main:h-auto! @max-xl/main:flex-wrap @max-xl/main:justify-start">
										<TabsTrigger
											value="all"
											className={cn("@max-xl/main:h-9 px-3", TAB_TOUCH_AREA)}
										>
											{t("posts.all")}
											<span className="text-muted-foreground tabular-nums">
												{number.format(channelPosts.length)}
											</span>
										</TabsTrigger>
										{tabs.map((tab) => (
											<TabsTrigger
												key={tab.value}
												value={tab.value}
												className={cn("@max-xl/main:h-9 px-3", TAB_TOUCH_AREA)}
											>
												{t(`posts.statuses.${tab.value}`)}
												<span className="text-muted-foreground tabular-nums">
													{number.format(tab.count)}
												</span>
											</TabsTrigger>
										))}
									</TabsList>
								</Tabs>
							</>
						}
					/>
				</CardContent>
			</Card>
		</div>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8"];

/** Placeholder while the list loader runs. The route sets it as pendingComponent. */
export function PostsPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-32" />
				<Skeleton className="h-4 w-80 max-w-full" />
			</div>
			<Card>
				<CardContent className="grid gap-3">
					<div className="flex flex-wrap gap-2">
						<Skeleton className="h-9 w-full sm:max-w-xs" />
						<Skeleton className="h-9 w-44" />
						<Skeleton className="h-9 w-80 max-w-full" />
					</div>
					{SKELETON_ROWS.map((key) => (
						<Skeleton key={key} className="h-12 w-full" />
					))}
				</CardContent>
			</Card>
		</div>
	);
}

/** Error state of the list and of a post page when the loader fails. */
export function PostsPageError() {
	const { t } = useT();
	return <LoadError message={t("posts.loadError")} />;
}
