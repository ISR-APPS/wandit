// The color mark of one channel: a small dot in the chart color of the channel, with an ink edge.
// Chart legends, the channel rows, the campaign table, and the calendar chips render it beside the channel name.
import { cn } from "~/shared/lib/utils";
import { CHANNEL_FILL, type Channel } from "../lib/channels";

type ChannelMarkProps = {
	channel: Channel;
	className?: string;
};

/** Decorative: the channel name always sits next to it, so screen readers skip the mark. */
export function ChannelMark({ channel, className }: ChannelMarkProps) {
	return (
		<span
			aria-hidden="true"
			className={cn(
				"inline-block size-2.5 shrink-0 rounded-sm border border-foreground/70",
				CHANNEL_FILL[channel],
				className,
			)}
		/>
	);
}
