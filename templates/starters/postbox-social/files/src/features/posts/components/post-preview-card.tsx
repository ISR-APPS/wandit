// The post as its readers see it: the account, the caption, and the hashtags. Then the pillar, the format, and the author.
// PostDetailPage renders it at the top of the rail.
import { ChannelMark, channelProfile, type Post } from "~/features/social";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";

type PostPreviewCardProps = {
	post: Post;
};

/** The caption keeps its own direction (dir="auto"): a team can write in another language than the app. */
export function PostPreviewCard({ post }: PostPreviewCardProps) {
	const { t } = useT();
	const profile = channelProfile(post.channelId);
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("posts.preview")}</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-4">
				<div className="grid gap-3 rounded-control border border-border bg-muted/40 p-4">
					<div className="flex items-center gap-3">
						<ChannelMark channelId={post.channelId} />
						<div className="grid min-w-0">
							<span className="truncate font-medium text-sm">
								<bdi>{profile.handle}</bdi>
							</span>
							<span className="text-muted-foreground text-xs">
								{t(`channels.names.${post.channelId}`)}
							</span>
						</div>
					</div>
					<p className="text-sm leading-relaxed" dir="auto">
						{post.caption}
					</p>
					<p className="text-muted-foreground text-sm" dir="auto">
						{post.hashtags.join(" ")}
					</p>
				</div>
				<dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
					<div className="grid gap-1">
						<dt className="text-muted-foreground">{t("posts.pillar")}</dt>
						<dd>
							<Badge variant="outline">{t(`pillars.${post.pillar}`)}</Badge>
						</dd>
					</div>
					<div className="grid gap-1">
						<dt className="text-muted-foreground">{t("posts.format")}</dt>
						<dd>
							<Badge variant="outline">{t(`formats.${post.format}`)}</Badge>
						</dd>
					</div>
					<div className="grid gap-1">
						<dt className="text-muted-foreground">{t("posts.author")}</dt>
						<dd>
							<bdi>{post.author}</bdi>
						</dd>
					</div>
					<div className="grid gap-1">
						<dt className="text-muted-foreground">{t("posts.approver")}</dt>
						<dd>
							{post.approver === "" ? (
								<span className="text-muted-foreground">
									{t("posts.notApproved")}
								</span>
							) : (
								<bdi>{post.approver}</bdi>
							)}
						</dd>
					</div>
				</dl>
			</CardContent>
		</Card>
	);
}
