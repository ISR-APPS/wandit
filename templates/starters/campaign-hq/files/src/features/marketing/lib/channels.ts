// The media channels of the team: where a campaign spends its budget and where content runs.
// Every page reads this list: the overview charts, the campaign tables, the calendar chips, and the filters.
// The order is the stack order of the charts, and each channel keeps one chart color everywhere.
import {
	EnvelopeSimpleIcon,
	HandshakeIcon,
	MagnifyingGlassIcon,
	ShareNetworkIcon,
	VideoIcon,
} from "@phosphor-icons/react";
import type { KitIcon } from "~/shared/ui/icons";

/** Every channel, in chart order. The label is the message key `channels.<channel>`. */
export const CHANNELS = [
	"paid_social",
	"search",
	"email",
	"video",
	"partners",
] as const;

/** One channel code. */
export type Channel = (typeof CHANNELS)[number];

/**
 * The fill class of each channel: chart-1 to chart-5 in CHANNELS order.
 * The class names stay whole in the code, so Tailwind finds them.
 */
export const CHANNEL_FILL = {
	paid_social: "bg-chart-1",
	search: "bg-chart-2",
	email: "bg-chart-3",
	video: "bg-chart-4",
	partners: "bg-chart-5",
} satisfies Record<Channel, string>;

/** The icon of each channel, for the icon tiles of the home report and the campaign page. */
export const CHANNEL_ICON = {
	paid_social: ShareNetworkIcon,
	search: MagnifyingGlassIcon,
	email: EnvelopeSimpleIcon,
	video: VideoIcon,
	partners: HandshakeIcon,
} satisfies Record<Channel, KitIcon>;

/** The CSS color of each channel for recharts, which takes a color value and not a class. */
export function channelColor(channel: Channel): string {
	return `var(--chart-${CHANNELS.indexOf(channel) + 1})`;
}

/** The channel of a text from a URL or a Select, or undefined for any other text. */
export function parseChannel(value: string): Channel | undefined {
	return CHANNELS.find((channel) => channel === value);
}
