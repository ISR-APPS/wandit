// A bar of booked against target, with a thin mark at the share that the pace expects today.
// The reps list, the rep page, and the targets page draw attainment with it.
// The fill color follows the pace status, so ahead, on pace, and behind read at a glance.
import { cn } from "~/shared/lib/utils";
import type { PaceStatus } from "../lib/pace";

/** The fill class of each pace status. Same hue as PACE_BADGE (pace.ts), so a bar and its badge match. */
const FILL_CLASS = {
	ahead: "bg-success",
	on_pace: "bg-info",
	behind: "bg-warning",
} satisfies Record<PaceStatus, string>;

type AttainmentBarProps = {
	/** booked / target. 1 is the full bar; a value above 1 shows full. */
	attainment: number;
	/** The share of the target that a linear pace expects today, 0 to 1. 1 hides the mark. */
	pace: number;
	status: PaceStatus;
	/** The text that screen readers read, for example "87% of target". */
	label: string;
	className?: string;
};

/** A slim bar. The pace mark is a 2 px line in the muted text color. It passes the bar on both sides. */
export function AttainmentBar({
	attainment,
	pace,
	status,
	label,
	className,
}: AttainmentBarProps) {
	const filled = Math.min(Math.max(attainment, 0), 1) * 100;
	return (
		<div
			role="img"
			aria-label={label}
			className={cn(
				"relative h-2 w-full rounded-(--badge-radius) bg-muted",
				className,
			)}
		>
			<div
				className={cn(
					"absolute inset-y-0 start-0 rounded-(--badge-radius)",
					FILL_CLASS[status],
				)}
				style={{ width: `${filled}%` }}
			/>
			{/* A closed quarter has no pace mark: the whole target is due. */}
			{pace < 1 ? (
				<div
					className="absolute -inset-y-1.5 w-0.5 rounded-full bg-muted-foreground"
					style={{ insetInlineStart: `calc(${pace * 100}% - 1px)` }}
				/>
			) : null}
		</div>
	);
}
