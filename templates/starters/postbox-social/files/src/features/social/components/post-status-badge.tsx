// The status of a post as a word and a color: published, scheduled, draft, or failed.
// The post list, the post page, the home, the schedule, and the channel page render it.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import { POST_STATUS_BADGE, type PostStatus } from "../lib/post-vocabulary";

type PostStatusBadgeProps = {
	status: PostStatus;
};

/** A status is never a color alone: the badge always holds the word. */
export function PostStatusBadge({ status }: PostStatusBadgeProps) {
	const { t } = useT();
	return (
		<Badge
			variant={POST_STATUS_BADGE[status]}
			// The destructive variant is solid red. This gives it the tinted look of the other statuses.
			className={cn(
				status === "failed" &&
					"border-destructive/25 bg-destructive/12 text-destructive hover:bg-destructive/12",
			)}
		>
			{t(`posts.statuses.${status}`)}
		</Badge>
	);
}
