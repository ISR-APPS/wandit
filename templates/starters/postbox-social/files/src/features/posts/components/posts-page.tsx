// The post list, on the layout of the kit "orders" page: the title and the export, status tabs,
// then the table with a filter field, Channel and Format filters, a column menu, checkboxes, and pages.
// The /app/posts route renders it after its loader. The tab and the two filters are state of the page.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	CHANNEL_IDS,
	type ChannelId,
	ChannelMark,
	type CsvColumn,
	channelProfile,
	copyToClipboard,
	downloadCsv,
	LoadError,
	POST_FORMATS,
	POST_STATUSES,
	type Post,
	type PostFormat,
	type PostStatus,
	PostStatusBadge,
	toCsv,
} from "~/features/social";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import {
	type RecordColumn,
	RecordFilter,
	RecordTable,
} from "~/shared/ui/record-table";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { postsQueryOptions } from "../api/posts.queries";

// The kit list shows ten rows per page.
const PAGE_SIZE = 10;

/** The tab of the list: every post, or one status. */
type StatusTab = PostStatus | "all";

/** The list of the last 90 days, the queue, and the drafts. Every control filters the rows in the browser. */
export function PostsPage() {
	const { t, locale } = useT();
	const { data: posts } = useSuspenseQuery(postsQueryOptions());
	const [tab, setTab] = useState<StatusTab>("all");
	const [channel, setChannel] = useState<string | null>(null);
	const [format, setFormat] = useState<string | null>(null);
	const number = new Intl.NumberFormat(locale);
	const dateTime = new Intl.DateTimeFormat(locale, {
		dateStyle: "medium",
		timeStyle: "short",
	});
	const formatWhen = (post: Post) =>
		post.publishAt
			? dateTime.format(new Date(post.publishAt))
			: t("posts.noSlot");

	const filtered = posts.filter(
		(post) =>
			(tab === "all" || post.status === tab) &&
			(channel === null || post.channelId === channel) &&
			(format === null || post.format === format),
	);
	// The "All" tab opens on the posts that went out, newest first, as the kit list opens on past orders.
	// The queue and the drafts follow them. The Scheduled and Draft tabs show them alone.
	const isQueued = (post: Post) =>
		post.status === "scheduled" || post.status === "draft";
	const rows =
		tab === "all"
			? [
					...filtered.filter((post) => !isQueued(post)),
					...filtered.filter(isQueued),
				]
			: filtered;

	const csvColumns: CsvColumn<Post>[] = [
		{ header: "ID", value: (post) => post.id },
		{ header: t("posts.post"), value: (post) => post.title },
		{
			header: t("posts.channel"),
			value: (post) => t(`channels.names.${post.channelId}`),
		},
		{ header: t("posts.date"), value: formatWhen },
		{ header: t("posts.format"), value: (post) => t(`formats.${post.format}`) },
		{
			header: t("posts.status"),
			value: (post) => t(`posts.statuses.${post.status}`),
		},
		{
			header: t("metrics.impressions"),
			value: (post) => String(post.impressions),
		},
		{
			header: t("metrics.engagements"),
			value: (post) => String(post.engagements),
		},
	];

	const columns: RecordColumn<Post>[] = [
		{
			id: "id",
			header: "#",
			cell: (post) => (
				<Link
					to="/app/posts/$postId"
					params={{ postId: post.id }}
					className="text-muted-foreground tabular-nums hover:text-foreground hover:underline"
				>
					{post.id}
				</Link>
			),
			sortValue: (post) => post.id,
		},
		{
			id: "post",
			header: t("posts.post"),
			cell: (post) => (
				<div className="flex min-w-56 items-center gap-4">
					<ChannelMark channelId={post.channelId} size="lg" />
					<Link
						to="/app/posts/$postId"
						params={{ postId: post.id }}
						className="max-w-72 whitespace-normal hover:underline"
					>
						{post.title}
					</Link>
				</div>
			),
		},
		{
			id: "impressions",
			header: t("metrics.impressions"),
			cell: (post) =>
				post.status === "published" ? number.format(post.impressions) : "–",
			sortValue: (post) => post.impressions,
			hideable: true,
		},
		{
			id: "channel",
			header: t("posts.channel"),
			cell: (post) => (
				<div className="grid gap-1">
					<span className="font-semibold">
						{t(`channels.names.${post.channelId}`)}
					</span>
					<span className="text-muted-foreground">
						{channelProfile(post.channelId).handle}
					</span>
				</div>
			),
			sortValue: (post) => t(`channels.names.${post.channelId}`),
			hideable: true,
		},
		{
			id: "date",
			header: t("posts.date"),
			cell: (post) => (
				<span className="whitespace-nowrap tabular-nums">
					{formatWhen(post)}
				</span>
			),
			// A draft has no slot: it sorts by its creation time.
			sortValue: (post) => Date.parse(post.publishAt ?? post.createdAt),
			hideable: true,
		},
		{
			id: "format",
			header: t("posts.format"),
			cell: (post) => t(`formats.${post.format}`),
			hideable: true,
		},
		{
			id: "status",
			header: t("posts.status"),
			cell: (post) => <PostStatusBadge status={post.status} />,
			sortValue: (post) => POST_STATUSES.indexOf(post.status),
			hideable: true,
		},
	];

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("posts.title")}
				description={t("posts.description")}
				actions={
					<Button
						type="button"
						onClick={() =>
							downloadCsv("postbox-posts.csv", toCsv(rows, csvColumns))
						}
					>
						<DownloadSimpleIcon />
						{t("posts.exportCsv")}
					</Button>
				}
			/>
			<Tabs
				value={tab}
				onValueChange={(value) =>
					setTab(POST_STATUSES.find((status) => status === value) ?? "all")
				}
			>
				<TabsList className="max-w-full overflow-x-auto">
					<TabsTrigger value="all">{t("posts.all")}</TabsTrigger>
					{POST_STATUSES.map((status) => (
						<TabsTrigger key={status} value={status}>
							{t(`posts.statuses.${status}`)}
						</TabsTrigger>
					))}
				</TabsList>
			</Tabs>
			<RecordTable
				rows={rows}
				columns={columns}
				searchText={(post) =>
					`${post.id} ${post.title} ${post.caption} ${post.hashtags.join(" ")}`
				}
				searchPlaceholder={t("posts.searchPlaceholder")}
				toolbar={
					<>
						<RecordFilter
							label={t("posts.channel")}
							options={CHANNEL_IDS.map((id: ChannelId) => ({
								value: id,
								label: t(`channels.names.${id}`),
							}))}
							value={channel}
							onValueChange={setChannel}
						/>
						<RecordFilter
							label={t("posts.format")}
							options={POST_FORMATS.map((id: PostFormat) => ({
								value: id,
								label: t(`formats.${id}`),
							}))}
							value={format}
							onValueChange={setFormat}
						/>
					</>
				}
				rowMenu={(post) => (
					<>
						<DropdownMenuItem asChild>
							<Link to="/app/posts/$postId" params={{ postId: post.id }}>
								{t("posts.open")}
							</Link>
						</DropdownMenuItem>
						<DropdownMenuItem
							onSelect={() =>
								copyToClipboard(post.id, {
									done: t("table.copied"),
									failed: t("table.copyFailed"),
								})
							}
						>
							{t("posts.copyId")}
						</DropdownMenuItem>
					</>
				)}
				selectable
				bulkActions={(selected) => (
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-9"
						onClick={() =>
							downloadCsv(
								"postbox-posts-selected.csv",
								toCsv(selected, csvColumns),
							)
						}
					>
						<DownloadSimpleIcon />
						{t("table.exportSelected")}
					</Button>
				)}
				pageSize={PAGE_SIZE}
				noResults={t("posts.noResults")}
			/>
		</div>
	);
}

/** Loading state of the post list: the header, the tabs, the toolbar, and ten rows. */
export function PostsPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex items-end justify-between gap-3">
				<Skeleton className="h-8 w-32" />
				<Skeleton className="h-9 w-32" />
			</div>
			<Skeleton className="h-9 w-96 max-w-full" />
			<Skeleton className="h-9 w-full" />
			<Skeleton className="h-160 w-full" />
		</div>
	);
}

/** Error state of the post pages when a loader fails. Try again runs the loader again. */
export function PostsPageError() {
	const { t } = useT();
	return <LoadError message={t("posts.loadError")} />;
}
