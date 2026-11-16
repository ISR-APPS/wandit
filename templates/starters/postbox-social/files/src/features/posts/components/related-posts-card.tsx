// Other published posts of the same content pillar, newest first, with their impressions.
// PostDetailPage renders it under the numbers. Each row opens the page of that post.
import { Link } from "@tanstack/react-router";
import {
	ChannelMark,
	fillMessage,
	formatRelativeTime,
	type Pillar,
	type Post,
	TOUCH_AREA,
} from "~/features/social";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";

type RelatedPostsCardProps = {
	/** The pillar of the open post. The title names it. */
	pillar: Pillar;
	/** Up to four published posts of that pillar, newest first. */
	posts: Post[];
};

/** An empty list says so in one line: a new pillar has no other post yet. */
export function RelatedPostsCard({ pillar, posts }: RelatedPostsCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const now = Date.now();
	return (
		<Card>
			<CardHeader>
				<CardTitle>
					{fillMessage(t("posts.related"), {
						pillar: t(`pillars.${pillar}`),
					})}
				</CardTitle>
			</CardHeader>
			<CardContent>
				{posts.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("posts.noRelated")}
					</p>
				) : (
					<ul className="grid divide-y divide-border">
						{posts.map((post) => (
							<li
								key={post.id}
								className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
							>
								<ChannelMark channelId={post.channelId} size="sm" />
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
										<span className="block truncate">{post.title}</span>
									</Link>
									<span className="text-muted-foreground text-xs">
										{`${t(`channels.names.${post.channelId}`)} · ${post.publishAt ? formatRelativeTime(post.publishAt, now, locale) : ""}`}
									</span>
								</div>
								<span className="shrink-0 text-end text-sm tabular-nums">
									{number.format(post.impressions)}
									<span className="block text-muted-foreground text-xs">
										{t("metrics.impressionsShort")}
									</span>
								</span>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
