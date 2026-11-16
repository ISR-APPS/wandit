// The tinted icon chip of a channel: the kind of network in the chart color of the channel.
// Every list, card, and chip that names a channel renders it beside the channel name.
import { cn } from "~/shared/lib/utils";
import { CHANNEL_ICONS, CHANNEL_TONES, type ChannelId } from "../lib/channels";

// The chip and icon size of each mark size.
const MARK_SIZES = {
	sm: "size-6 [&_svg]:size-3.5",
	md: "size-9 [&_svg]:size-4.5",
	lg: "size-12 [&_svg]:size-6",
} as const;

type ChannelMarkProps = {
	channelId: ChannelId;
	/** sm in dense rows and chips, md in lists, lg in a card or a page header. */
	size?: keyof typeof MARK_SIZES;
	className?: string;
};

/** Decorative: the channel name always stands next to it, so screen readers skip the chip. */
export function ChannelMark({
	channelId,
	size = "md",
	className,
}: ChannelMarkProps) {
	const Icon = CHANNEL_ICONS[channelId];
	const tone = CHANNEL_TONES[channelId];
	return (
		<span
			aria-hidden="true"
			className={cn(
				"flex shrink-0 items-center justify-center rounded-control",
				MARK_SIZES[size],
				tone.soft,
				tone.text,
				className,
			)}
		>
			<Icon />
		</span>
	);
}
