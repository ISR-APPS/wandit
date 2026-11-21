// One post as the network shows it, in the feed of the post page: the account row with a menu,
// a media block, the reaction counts, the caption, and a footer with the reach of the post.
// PostDetailPage renders it for the open post and for other posts of the same channel. No photo: the media block
// shows the channel icon on the channel tint, so a real image can replace it later.
import {
	BookmarkSimpleIcon,
	ChatCircleIcon,
	DotsThreeIcon,
	HeartIcon,
	PaperPlaneTiltIcon,
	SealCheckIcon,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import {
	CHANNEL_ICONS,
	CHANNEL_TONES,
	ChannelMark,
	channelProfile,
	copyToClipboard,
	countForm,
	fillMessage,
	formatRelativeTime,
	type Post,
	PostStatusBadge,
	rateFormat,
} from "~/features/social";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Button } from "~/shared/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "~/shared/ui/dropdown-menu";

type PostItemProps = {
	post: Post;
	/** Milliseconds since 1970 of the render, for "2 hours ago". */
	now: number;
	/** True for the post of the page: its title is a heading, not a link. */
	isCurrent?: boolean;
};

/** The reaction counts are text, not buttons: Postbox reads the network and does not like or share. */
export function PostItem({ post, now, isCurrent = false }: PostItemProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const profile = channelProfile(post.channelId);
	const ChannelIcon = CHANNEL_ICONS[post.channelId];
	const tone = CHANNEL_TONES[post.channelId];
	const isLive = post.status === "published";
	const when = post.publishAt ?? post.createdAt;
	const reactions = [
		{ id: "likes", icon: HeartIcon, value: post.likes },
		{ id: "comments", icon: ChatCircleIcon, value: post.comments },
		{ id: "shares", icon: PaperPlaneTiltIcon, value: post.shares },
	] as const;

	return (
		<article className="grid gap-3 rounded-surface border bg-card py-4 text-card-foreground">
			<div className="flex items-start justify-between gap-3 px-4">
				<div className="flex min-w-0 items-center gap-3">
					<ChannelMark
						channelId={post.channelId}
						className="size-10 rounded-full"
					/>
					<div className="grid min-w-0 gap-0.5">
						<span className="flex items-center gap-1">
							<span className="truncate font-semibold text-sm">
								{profile.handle}
							</span>
							<SealCheckIcon
								className="size-4 shrink-0"
								aria-label={t("posts.verified")}
							/>
						</span>
						<time dateTime={when} className="text-muted-foreground text-xs">
							{formatRelativeTime(when, now, locale)}
						</time>
					</div>
				</div>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							className="size-8"
							aria-label={t("table.rowActions")}
						>
							<DotsThreeIcon className="size-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="min-w-40">
						{isCurrent ? null : (
							<DropdownMenuItem asChild>
								<Link to="/app/posts/$postId" params={{ postId: post.id }}>
									{t("posts.open")}
								</Link>
							</DropdownMenuItem>
						)}
						<DropdownMenuItem asChild>
							<Link
								to="/app/channels/$channelId"
								params={{ channelId: post.channelId }}
							>
								{t("posts.openChannel")}
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
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
			<div className="px-4">
				<div
					className={cn(
						"flex aspect-video flex-col items-center justify-center gap-3 rounded-surface p-6 text-center",
						tone.soft,
					)}
				>
					<ChannelIcon
						className={cn("size-12", tone.text)}
						aria-hidden="true"
					/>
					{isCurrent ? (
						<h2 className="max-w-md font-display font-semibold text-lg">
							{post.title}
						</h2>
					) : (
						<Link
							to="/app/posts/$postId"
							params={{ postId: post.id }}
							className="max-w-md font-display font-semibold text-lg hover:underline"
						>
							{post.title}
						</Link>
					)}
					<span className="text-muted-foreground text-xs">
						{t(`formats.${post.format}`)} · {t(`pillars.${post.pillar}`)}
					</span>
				</div>
			</div>
			<div className="flex items-center justify-between gap-3 px-4">
				<ul className="flex items-center gap-4">
					{reactions.map((reaction) => (
						<li
							key={reaction.id}
							className="flex items-center gap-1.5 text-sm tabular-nums"
						>
							<reaction.icon
								className="size-5"
								aria-label={t(`posts.reactions.${reaction.id}`)}
							/>
							{number.format(reaction.value)}
						</li>
					))}
				</ul>
				<span className="flex items-center gap-1.5 text-sm tabular-nums">
					<BookmarkSimpleIcon
						className="size-5"
						aria-label={t("posts.reactions.saves")}
					/>
					{number.format(post.saves)}
				</span>
			</div>
			<div className="grid gap-2 px-4">
				<p className="font-semibold text-sm tabular-nums">
					{fillMessage(t(`posts.likesLine.${countForm(locale, post.likes)}`), {
						count: number.format(post.likes),
					})}
				</p>
				<p className="whitespace-pre-line text-sm" dir="auto">
					<span className="font-semibold">{profile.handle}</span> {post.caption}{" "}
					<span className="text-primary">{post.hashtags.join(" ")}</span>
				</p>
				<p className="text-muted-foreground text-xs">
					{isLive
						? fillMessage(
								t(`posts.commentsLine.${countForm(locale, post.comments)}`),
								{
									count: number.format(post.comments),
								},
							)
						: post.publishAt
							? fillMessage(t("posts.goesLiveLine"), {
									when: formatRelativeTime(post.publishAt, now, locale),
								})
							: t("posts.waitingDraft")}
				</p>
			</div>
			<div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t px-4 pt-3 text-muted-foreground text-sm">
				<span className="tabular-nums">
					{fillMessage(
						t(`posts.impressionsLine.${countForm(locale, post.impressions)}`),
						{
							count: number.format(post.impressions),
						},
					)}
				</span>
				<span className="tabular-nums">
					{fillMessage(t("posts.rateLine"), {
						rate: rateFormat(locale).format(
							post.impressions === 0 ? 0 : post.engagements / post.impressions,
						),
					})}
				</span>
				<span className="ms-auto">
					<PostStatusBadge status={post.status} />
				</span>
			</div>
		</article>
	);
}
