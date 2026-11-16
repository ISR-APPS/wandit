// The small round mark of one feed action: an upload, a new version, a share, or a move to the trash.
// The Recent page feed and the history card of the file page render it at the start of each entry.
import {
	ArrowsClockwiseIcon,
	CloudArrowUpIcon,
	ShareNetworkIcon,
	TrashSimpleIcon,
} from "@phosphor-icons/react";
import type { KitIcon } from "~/shared/ui/icons";
import type { ActivityAction } from "../lib/codes";

/** The icon of each action. */
const ACTION_ICONS = {
	uploaded: CloudArrowUpIcon,
	updated: ArrowsClockwiseIcon,
	shared: ShareNetworkIcon,
	deleted: TrashSimpleIcon,
} satisfies Record<ActivityAction, KitIcon>;

type ActivityMarkProps = {
	action: ActivityAction;
};

/** A 28 px circle on the card fill, with a ring so a timeline line can pass behind it. The text says the action. */
export function ActivityMark({ action }: ActivityMarkProps) {
	const Icon = ACTION_ICONS[action];
	return (
		<span className="relative z-10 inline-flex size-7 shrink-0 items-center justify-center rounded-full border bg-card text-muted-foreground [&_svg]:size-3.5">
			<Icon />
		</span>
	);
}
