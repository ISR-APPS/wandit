// The five social accounts of the brand, with the facts that do not change from day to day.
// sample-data.ts reads the rates and the cadence to play the history. The pages read the names, icons, and colors.
// The label of a channel is the message key `channels.names.<id>`. The label of a format is `formats.<format>`.
import {
	BriefcaseIcon,
	CameraIcon,
	ChatTextIcon,
	FilmReelIcon,
	MonitorPlayIcon,
} from "@phosphor-icons/react";
import type { KitIcon } from "~/shared/ui/icons";

/** Every channel, in the order of the nav and the legends. The order also gives the chart color. */
export const CHANNEL_IDS = [
	"photo",
	"shorts",
	"video",
	"pro",
	"microblog",
] as const;

/** One channel: an account of the brand on one kind of network. */
export type ChannelId = (typeof CHANNEL_IDS)[number];

/** The kinds of post. A channel publishes only the formats of its profile. */
export const POST_FORMATS = [
	"image",
	"carousel",
	"reel",
	"video",
	"text",
	"link",
] as const;

/** One kind of post. Its label is the message key `formats.<format>`. */
export type PostFormat = (typeof POST_FORMATS)[number];

/** The fixed facts of one channel. The sample history grows from them. */
export type ChannelProfile = {
	id: ChannelId;
	/** The account name on the network, as the network shows it. */
	handle: string;
	/** Followers at the end of yesterday. */
	followers: number;
	/** The weekly posting goal of the team. The sample history posts close to it. */
	postsPerWeek: number;
	/** Impressions of an average post over its first four days. */
	impressionsPerPost: number;
	/** Engagements over impressions of an average post: 0.048 is 4.8 %. */
	engagementRate: number;
	/** Impressions per day that do not come from new posts: the profile, search, and older posts. */
	baselineImpressions: number;
	/** Net new followers per day, as a share of the followers. */
	dailyGrowth: number;
	/** The formats that this channel publishes. */
	formats: readonly PostFormat[];
	/** The hours of the day (0 to 23) when the team posts here. */
	postingHours: readonly number[];
	/** Days since the team connected the account to Postbox. */
	connectedDaysAgo: number;
};

/** The five accounts of Fernhill Review, a fictional culture magazine. */
export const CHANNELS: readonly ChannelProfile[] = [
	{
		id: "photo",
		handle: "@fernhillreview",
		followers: 48_260,
		postsPerWeek: 4,
		impressionsPerPost: 12_500,
		engagementRate: 0.052,
		baselineImpressions: 9_200,
		dailyGrowth: 0.0011,
		formats: ["image", "carousel", "reel"],
		postingHours: [8, 12, 18, 19],
		connectedDaysAgo: 612,
	},
	{
		id: "shorts",
		handle: "@fernhill.review",
		followers: 31_540,
		postsPerWeek: 3,
		impressionsPerPost: 11_000,
		engagementRate: 0.044,
		baselineImpressions: 7_600,
		dailyGrowth: 0.0019,
		formats: ["reel"],
		postingHours: [17, 19, 20, 21],
		connectedDaysAgo: 388,
	},
	{
		id: "video",
		handle: "Fernhill Review",
		followers: 12_870,
		postsPerWeek: 1,
		impressionsPerPost: 11_800,
		engagementRate: 0.034,
		baselineImpressions: 3_100,
		dailyGrowth: 0.0009,
		// The long-video network also takes short vertical clips. The team cuts them from each episode.
		formats: ["video", "reel"],
		postingHours: [10, 16],
		connectedDaysAgo: 540,
	},
	{
		id: "pro",
		handle: "Fernhill Review Ltd",
		followers: 8_410,
		postsPerWeek: 2,
		impressionsPerPost: 4_700,
		engagementRate: 0.027,
		baselineImpressions: 1_400,
		dailyGrowth: 0.0008,
		formats: ["text", "link", "carousel"],
		postingHours: [8, 9, 12],
		connectedDaysAgo: 497,
	},
	{
		id: "microblog",
		handle: "@fernhill_review",
		followers: 15_730,
		postsPerWeek: 2,
		impressionsPerPost: 3_600,
		engagementRate: 0.021,
		baselineImpressions: 2_200,
		dailyGrowth: 0.0003,
		formats: ["text", "link", "image"],
		postingHours: [9, 13, 17],
		connectedDaysAgo: 701,
	},
];

/** The profile of one channel. Every id of CHANNEL_IDS has a profile, so the result is never undefined. */
export function channelProfile(id: ChannelId): ChannelProfile {
	const profile = CHANNELS.find((channel) => channel.id === id);
	if (!profile) {
		throw new Error(`Unknown channel ${id}`);
	}
	return profile;
}

/** The icon of each channel: the kind of network, never a brand logo. */
export const CHANNEL_ICONS = {
	photo: CameraIcon,
	shorts: FilmReelIcon,
	video: MonitorPlayIcon,
	pro: BriefcaseIcon,
	microblog: ChatTextIcon,
} satisfies Record<ChannelId, KitIcon>;

/** The classes and the chart color of one channel. Tailwind needs each class as a full literal. */
export type ChannelTone = {
	/** Icon color on a tinted chip. */
	text: string;
	/** The tinted chip behind the icon. */
	soft: string;
	/** A solid fill: share bars, dots, and legend marks. */
	solid: string;
	/** The CSS color for a recharts series. */
	color: string;
};

/** One chart color per channel, in the order of CHANNEL_IDS. The theme sets the five chart tokens. */
export const CHANNEL_TONES = {
	photo: {
		text: "text-chart-1",
		soft: "bg-chart-1/15",
		solid: "bg-chart-1",
		color: "var(--chart-1)",
	},
	shorts: {
		text: "text-chart-2",
		soft: "bg-chart-2/15",
		solid: "bg-chart-2",
		color: "var(--chart-2)",
	},
	video: {
		text: "text-chart-3",
		soft: "bg-chart-3/15",
		solid: "bg-chart-3",
		color: "var(--chart-3)",
	},
	pro: {
		text: "text-chart-4",
		soft: "bg-chart-4/15",
		solid: "bg-chart-4",
		color: "var(--chart-4)",
	},
	microblog: {
		text: "text-chart-5",
		soft: "bg-chart-5/15",
		solid: "bg-chart-5",
		color: "var(--chart-5)",
	},
} satisfies Record<ChannelId, ChannelTone>;
