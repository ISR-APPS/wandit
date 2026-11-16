// The icon and the color of each status that a post can have on the week board.
// PostChip draws one icon per chip. WeekBoard draws the same icons in its legend.
import {
	CheckCircleIcon,
	ClockIcon,
	WarningCircleIcon,
} from "@phosphor-icons/react";
import type { KitIcon } from "~/shared/ui/icons";
import type { BoardPost } from "./week";

/** One entry per status of a board post. Drafts have no entry: they have no day on the board. */
export const CHIP_STATUS = {
	published: { icon: CheckCircleIcon, className: "text-success" },
	scheduled: { icon: ClockIcon, className: "text-info" },
	failed: { icon: WarningCircleIcon, className: "text-destructive" },
} satisfies Record<BoardPost["status"], { icon: KitIcon; className: string }>;
