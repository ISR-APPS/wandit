// The newest rows of the home: the six latest posts that went out (or failed), with status and impressions.
// OverviewPage renders it beside the ranking. It reads the post list that the loader prefetched.
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { postsQueryOptions } from "~/features/posts";
import {
	ChannelMark,
	fillMessage,
	formatRelativeTime,
	PostStatusBadge,
	TOUCH_AREA,
} from "~/features/social";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";

// Six rows match the height of the ranking beside it.
const ROW_COUNT = 6;

/** Scheduled posts and drafts stay out: this card shows what the audience already saw. */
export function LatestPostsCard() {
	const { t, locale } = useT();
	const { data: posts } = useSuspenseQuery(postsQueryOptions());
	const number = new Intl.NumberFormat(locale);
	const now = Date.now();
	const rows = posts
		.filter((post) => post.status === "published" || post.status === "failed")
		.slice(0, ROW_COUNT);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("overview.latestTitle")}</CardTitle>
				<CardDescription>{t("overview.latestDescription")}</CardDescription>
				<CardAction>
					<Button asChild variant="outline" size="sm" className={TOUCH_AREA}>
						<Link to="/app/posts">{t("overview.seeAll")}</Link>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent>
				<ul className="grid divide-y divide-border">
					{rows.map((post) => (
						<li
							key={post.id}
							className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
						>
							<ChannelMark channelId={post.channelId} />
							<div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)] justify-items-start">
								<Link
									to="/app/posts/$postId"
									params={{ postId: post.id }}
									className={cn(
										"max-w-full font-medium text-sm hover:underline",
										TOUCH_AREA,
									)}
									dir="auto"
								>
									<span className="@xl/main:line-clamp-1 line-clamp-2">
										{post.title}
									</span>
								</Link>
								<span className="text-muted-foreground text-xs">
									{`${t(`channels.names.${post.channelId}`)} · ${post.publishAt ? formatRelativeTime(post.publishAt, now, locale) : ""}`}
								</span>
							</div>
							<div className="grid shrink-0 justify-items-end gap-1">
								<PostStatusBadge status={post.status} />
								<span
									className={cn(
										"text-muted-foreground text-xs tabular-nums",
										post.status === "failed" && "invisible",
									)}
								>
									{fillMessage(t("overview.impressionsCount"), {
										count: number.format(post.impressions),
									})}
								</span>
							</div>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
