// One post on the week board: the channel, the time, a status icon, and the headline. A click opens the post page.
// WeekBoard renders one chip per post in each day column and in the phone agenda.
import { Link } from "@tanstack/react-router";
import { CHANNEL_TONES, ChannelMark } from "~/features/social";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { CHIP_STATUS } from "../lib/chip-status";
import type { BoardPost } from "../lib/week";

type PostChipProps = {
	post: BoardPost;
};

/** The status is an icon with a screen reader word, so a color is never the only mark. */
export function PostChip({ post }: PostChipProps) {
	const { t, locale } = useT();
	const time = new Intl.DateTimeFormat(locale, {
		hour: "numeric",
		minute: "2-digit",
	});
	const status = CHIP_STATUS[post.status];
	return (
		<Link
			to="/app/posts/$postId"
			params={{ postId: post.id }}
			className={cn(
				"group relative grid gap-1.5 overflow-hidden rounded-control bg-muted/60 py-2 ps-3 pe-2 text-start transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring",
				post.status === "failed" && "bg-destructive/10",
			)}
		>
			{/* The thin strip at the start side carries the channel color. */}
			<span
				aria-hidden="true"
				className={cn(
					"absolute inset-y-0 start-0 w-1",
					CHANNEL_TONES[post.channelId].solid,
				)}
			/>
			<span className="flex items-center gap-1.5">
				<ChannelMark channelId={post.channelId} size="sm" className="size-5" />
				<span className="whitespace-nowrap text-muted-foreground text-xs tabular-nums">
					{time.format(new Date(post.publishAt))}
				</span>
				<status.icon
					className={cn("ms-auto size-3.5 shrink-0", status.className)}
				/>
				<span className="sr-only">{t(`posts.statuses.${post.status}`)}</span>
			</span>
			<span
				className="line-clamp-2 font-medium text-xs leading-snug"
				dir="auto"
			>
				{post.title}
			</span>
		</Link>
	);
}
