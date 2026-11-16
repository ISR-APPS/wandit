// The legend of a channel chart: one mark and one name per channel, in stack order.
// The home trend panel and the campaign spend panel render it in their header, not under the plot.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import type { Channel } from "../lib/channels";
import { ChannelMark } from "./channel-mark";

type ChannelLegendProps = {
	/** The series of the chart, the bottom one first. */
	channels: readonly Channel[];
	className?: string;
};

/** A wrapping row of marks. The chart colors follow the channels, so the legend needs no config. */
export function ChannelLegend({ channels, className }: ChannelLegendProps) {
	const { t } = useT();
	return (
		<ul
			className={cn(
				"flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-xs",
				className,
			)}
		>
			{channels.map((channel) => (
				<li key={channel} className="flex items-center gap-1.5">
					<ChannelMark channel={channel} />
					{t(`channels.${channel}`)}
				</li>
			))}
		</ul>
	);
}
