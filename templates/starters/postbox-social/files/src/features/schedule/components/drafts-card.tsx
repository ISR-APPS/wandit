// The drafts that wait for a time slot: the channel, the headline, the format, the author, and the age.
// SchedulePage renders it beside the weekly goals. Each row opens the post page of the draft.
import { Link } from "@tanstack/react-router";
import {
	ChannelMark,
	fillMessage,
	formatRelativeTime,
	type Post,
	TOUCH_AREA,
} from "~/features/social";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";

type DraftsCardProps = {
	/** Every post with the status draft, newest first. */
	drafts: Post[];
};

/** No draft is real data too: the card then says so in one line. */
export function DraftsCard({ drafts }: DraftsCardProps) {
	const { t, locale } = useT();
	const now = Date.now();
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("schedule.draftsTitle")}</CardTitle>
				<CardDescription>{t("schedule.draftsDescription")}</CardDescription>
			</CardHeader>
			<CardContent>
				{drafts.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("schedule.noDrafts")}
					</p>
				) : (
					<ul className="grid divide-y divide-border">
						{drafts.map((draft) => (
							<li
								key={draft.id}
								className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
							>
								<ChannelMark channelId={draft.channelId} />
								<div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)] justify-items-start">
									<Link
										to="/app/posts/$postId"
										params={{ postId: draft.id }}
										className={cn(
											"max-w-full font-medium text-sm hover:underline",
											TOUCH_AREA,
										)}
										dir="auto"
									>
										<span className="block truncate">{draft.title}</span>
									</Link>
									<span className="text-muted-foreground text-xs">
										{fillMessage(t("schedule.draftedBy"), {
											name: draft.author,
											when: formatRelativeTime(draft.createdAt, now, locale),
										})}
									</span>
								</div>
								<Badge variant="outline" className="shrink-0">
									{t(`formats.${draft.format}`)}
								</Badge>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
