import { BugIcon } from "@phosphor-icons/react/Bug";
import { ChatCircleTextIcon } from "@phosphor-icons/react/ChatCircleText";
import { HeartIcon } from "@phosphor-icons/react/Heart";
import { LightbulbIcon } from "@phosphor-icons/react/Lightbulb";

import { Badge } from "@/components/ui/badge";
import { titleCaseFeedbackValue } from "@/features/feedback/lib/feedback";
import type {
	FeedbackPriority,
	FeedbackStatus,
	FeedbackType,
} from "@/features/feedback/types";
import { cn } from "@/lib/utils";

const typeConfig = {
	bug: {
		label: "Bug",
		icon: BugIcon,
		className:
			"border-destructive/15 bg-destructive/8 text-destructive dark:bg-destructive/12",
	},
	idea: {
		label: "Idea",
		icon: LightbulbIcon,
		className:
			"border-amber-500/15 bg-amber-500/10 text-amber-800 dark:text-amber-300",
	},
	experience: {
		label: "Experience",
		icon: ChatCircleTextIcon,
		className: "border-sky-500/15 bg-sky-500/10 text-sky-800 dark:text-sky-300",
	},
	praise: {
		label: "Praise",
		icon: HeartIcon,
		className:
			"border-emerald-500/15 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
	},
} as const;

const statusClasses: Record<FeedbackStatus, string> = {
	new: "border-primary/20 bg-primary/8 text-primary",
	reviewing: "border-sky-500/15 bg-sky-500/10 text-sky-800 dark:text-sky-300",
	planned:
		"border-amber-500/15 bg-amber-500/10 text-amber-800 dark:text-amber-300",
	resolved:
		"border-emerald-500/15 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
};

const priorityClasses: Record<FeedbackPriority, string> = {
	urgent:
		"border-destructive/20 bg-destructive/8 text-destructive dark:bg-destructive/12",
	high: "border-orange-500/20 bg-orange-500/10 text-orange-800 dark:text-orange-300",
	medium: "border-border bg-muted/50 text-muted-foreground",
	low: "border-transparent bg-transparent text-muted-foreground",
};

function FeedbackTypeBadge({ type }: { type: FeedbackType }) {
	const config = typeConfig[type];

	return (
		<Badge variant="outline" className={cn("font-medium", config.className)}>
			<config.icon aria-hidden="true" weight="regular" />
			{config.label}
		</Badge>
	);
}

function FeedbackStatusBadge({ status }: { status: FeedbackStatus }) {
	return (
		<Badge
			variant="outline"
			className={cn("gap-1.5 font-medium", statusClasses[status])}
		>
			<span
				aria-hidden="true"
				className={cn(
					"size-1.5 rounded-full bg-current",
					status === "new" && "animate-[pulse-dot_2.4s_ease-in-out_infinite]",
				)}
			/>
			{titleCaseFeedbackValue(status)}
		</Badge>
	);
}

function FeedbackPriorityBadge({ priority }: { priority: FeedbackPriority }) {
	return (
		<Badge
			variant="outline"
			className={cn("font-medium", priorityClasses[priority])}
		>
			{titleCaseFeedbackValue(priority)}
		</Badge>
	);
}

export { FeedbackPriorityBadge, FeedbackStatusBadge, FeedbackTypeBadge };
