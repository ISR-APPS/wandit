// The top posts of one channel in the period: headline, format and date, impressions, and engagement rate.
// ChannelDetailPage renders it under the trend. Each headline opens the post page.
import { Link } from "@tanstack/react-router";
import { type Post, rateFormat, TOUCH_AREA } from "~/features/social";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/shared/ui/table";

type ChannelTopPostsCardProps = {
	/** Up to five published posts of the channel, the most impressions first. */
	posts: Post[];
};

/** A period with no post shows one muted line in the same frame. */
export function ChannelTopPostsCard({ posts }: ChannelTopPostsCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const rate = rateFormat(locale);
	const date = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
	});
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("channels.topPostsTitle")}</CardTitle>
				<CardDescription>{t("channels.topPostsDescription")}</CardDescription>
			</CardHeader>
			<CardContent>
				{posts.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("channels.noTopPosts")}
					</p>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t("posts.post")}</TableHead>
								<TableHead className="text-end">
									{t("metrics.impressions")}
								</TableHead>
								{/* A phone hides the rate, so the impressions stay in view without a sideways scroll. */}
								<TableHead className="@xl/main:table-cell hidden text-end">
									{t("metrics.engagementRateShort")}
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{posts.map((post) => (
								<TableRow key={post.id}>
									<TableCell>
										{/* A fixed track on a phone keeps the impressions visible, so a long title truncates. */}
										<div className="grid @xl/main:w-auto w-44 @xl/main:max-w-sm grid-cols-[minmax(0,1fr)] justify-items-start">
											<Link
												to="/app/posts/$postId"
												params={{ postId: post.id }}
												className={cn(
													"max-w-full font-medium hover:underline",
													TOUCH_AREA,
												)}
												dir="auto"
											>
												<span className="block truncate">{post.title}</span>
											</Link>
											<span className="text-muted-foreground text-xs tabular-nums">
												{t(`formats.${post.format}`)}
												{post.publishAt
													? ` · ${date.format(new Date(post.publishAt))}`
													: ""}
											</span>
										</div>
									</TableCell>
									<TableCell className="text-end tabular-nums">
										{number.format(post.impressions)}
									</TableCell>
									<TableCell className="@xl/main:table-cell hidden text-end tabular-nums">
										{rate.format(
											post.impressions === 0
												? 0
												: post.engagements / post.impressions,
										)}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</CardContent>
		</Card>
	);
}
