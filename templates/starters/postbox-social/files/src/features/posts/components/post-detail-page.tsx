// The page of one post: its status and slot, its numbers against the channel, related posts, the preview, and the timeline.
// The /app/posts/$postId route renders it after its loader. The route also uses the skeleton below.
// An unknown id shows a not-found block with a link back to the list.
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { PageHeader } from "~/features/app-shell";
import { ChannelMark, PostStatusBadge, TOUCH_AREA } from "~/features/social";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Button } from "~/shared/ui/button";
import { CaretLeftIcon } from "~/shared/ui/icons";
import { Skeleton } from "~/shared/ui/skeleton";
import { postQueryOptions } from "../api/posts.queries";
import { PostPerformanceCard } from "./post-performance-card";
import { PostPreviewCard } from "./post-preview-card";
import { PostTimelineCard } from "./post-timeline-card";
import { RelatedPostsCard } from "./related-posts-card";

type PostDetailPageProps = {
	/** The `$postId` param of the URL. An unknown id shows the not-found block. */
	postId: string;
};

/** A 2/3 main column and a 1/3 rail from the 5xl container width. */
export function PostDetailPage({ postId }: PostDetailPageProps) {
	const { t, locale } = useT();
	const { data: detail } = useSuspenseQuery(postQueryOptions(postId));

	const backLink = (
		<Button
			asChild
			variant="ghost"
			size="sm"
			className={cn("-ms-3 justify-self-start", TOUCH_AREA)}
		>
			<Link to="/app/posts">
				<CaretLeftIcon className="rtl:rotate-180" />
				{t("posts.title")}
			</Link>
		</Button>
	);
	if (!detail) {
		return (
			<div className="grid gap-4">
				{backLink}
				<p className="text-muted-foreground text-sm">{t("posts.notFound")}</p>
			</div>
		);
	}

	const { post } = detail;
	const dateTime = new Intl.DateTimeFormat(locale, {
		weekday: "short",
		day: "numeric",
		month: "short",
		hour: "numeric",
		minute: "2-digit",
	});

	return (
		<div className="grid gap-6">
			{backLink}
			<PageHeader
				title={post.title}
				description={
					<span className="flex flex-wrap items-center gap-x-3 gap-y-2">
						<PostStatusBadge status={post.status} />
						<span className="flex items-center gap-2">
							<ChannelMark channelId={post.channelId} size="sm" />
							{t(`channels.names.${post.channelId}`)}
						</span>
						<span className="tabular-nums">
							{post.publishAt
								? dateTime.format(new Date(post.publishAt))
								: t("posts.noSlot")}
						</span>
					</span>
				}
			/>
			<div className="grid @5xl/main:grid-cols-3 items-start gap-6">
				<div className="@5xl/main:col-span-2 grid gap-6">
					<PostPerformanceCard detail={detail} />
					<RelatedPostsCard pillar={post.pillar} posts={detail.related} />
				</div>
				<div className="grid gap-6">
					<PostPreviewCard post={post} />
					<PostTimelineCard post={post} />
				</div>
			</div>
		</div>
	);
}

/** Placeholder while the detail loader runs. The route sets it as pendingComponent. */
export function PostDetailPageSkeleton() {
	return (
		<div className="grid gap-6">
			<Skeleton className="h-8 w-24" />
			<div className="grid gap-2">
				<Skeleton className="h-8 w-80 max-w-full" />
				<Skeleton className="h-5 w-64 max-w-full" />
			</div>
			<div className="grid @5xl/main:grid-cols-3 items-start gap-6">
				<div className="@5xl/main:col-span-2 grid gap-6">
					<Skeleton className="h-96" />
					<Skeleton className="h-64" />
				</div>
				<div className="grid gap-6">
					<Skeleton className="h-80" />
					<Skeleton className="h-64" />
				</div>
			</div>
		</div>
	);
}
