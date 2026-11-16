// The priority of a task as four signal bars, with the word for screen readers or beside the bars.
// The board cards, the task rows, and the task dialog render it.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import type { TaskPriority } from "../lib/codes";

// More filled bars mean a higher priority. The empty bars stay visible, so the level reads as "2 of 4".
const FILLED_BARS = {
	urgent: 4,
	high: 3,
	medium: 2,
	low: 1,
} satisfies Record<TaskPriority, number>;

// Urgent and high take a status color. Medium and low take the full muted text color, so they stay readable.
const PRIORITY_COLOR = {
	urgent: "bg-destructive",
	high: "bg-warning",
	medium: "bg-muted-foreground",
	low: "bg-muted-foreground",
} satisfies Record<TaskPriority, string>;

// The bar heights from short to tall: 4, 7, 10, and 13 px. The mark is 14 px tall, like a text line of xs.
const BAR_HEIGHTS = ["h-1", "h-1.75", "h-2.5", "h-3.25"] as const;

type PriorityMarkProps = {
	priority: TaskPriority;
	/** true shows the word beside the bars. false keeps the word for screen readers only. */
	showLabel?: boolean;
};

/** The bars alone on a dense card, the bars and the word in a dialog. */
export function PriorityMark({
	priority,
	showLabel = false,
}: PriorityMarkProps) {
	const { t } = useT();
	const label = t(`priority.${priority}`);
	return (
		<span
			className="inline-flex items-center gap-1.5"
			title={showLabel ? undefined : label}
		>
			<span aria-hidden="true" className="flex h-3.5 items-end gap-0.5">
				{BAR_HEIGHTS.map((height, index) => (
					<span
						key={height}
						className={cn(
							"w-0.75 rounded-full",
							height,
							index < FILLED_BARS[priority]
								? PRIORITY_COLOR[priority]
								: "bg-muted-foreground/25",
						)}
					/>
				))}
			</span>
			<span className={showLabel ? "text-sm" : "sr-only"}>{label}</span>
		</span>
	);
}
