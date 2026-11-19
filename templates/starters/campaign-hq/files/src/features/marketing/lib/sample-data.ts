// The sample tables of the marketing team: team, campaigns, daily channel results, audiences, content, and events.
// Only the query files (api/*.queries.ts of each feature) read them, through getSampleTables().
// The rows stand in for a database. A later turn replaces each queryFn with a Supabase call, then deletes this file.
// Every date is relative to the midnight that starts today. A seeded generator makes the same rows for the whole day.
// LIMIT: the history moves by one day at midnight, so the rows change then. Upgrade: real tables (STARTER.md).
import type { AudienceType } from "./audience-type";
import type { CampaignObjective, CampaignStatus } from "./campaign-status";
import { CHANNELS, type Channel } from "./channels";
import {
	CONTENT_FORMAT_CHANNEL,
	CONTENT_FORMATS,
	type ContentFormat,
	type ContentStage,
} from "./content";
import type { MediaTotals } from "./metrics";
import { MINUTE_MS, shiftDays, startOfLocalDay } from "./relative-time";

/** One person of the marketing team. A campaign and a calendar item have one owner. */
export type TeamMemberRow = {
	id: string;
	name: string;
	/** The job title, for example "Paid media lead". */
	role: string;
};

/** One campaign: a flight of paid media for one client brand. The times are ISO texts. */
export type CampaignRow = {
	/** For example "cmp-118". Also the `$campaignId` of the detail route. */
	id: string;
	/** The code that the team writes in briefs and reports, for example "CMP-118". */
	code: string;
	name: string;
	/** The client brand that pays for the campaign. */
	client: string;
	objective: CampaignObjective;
	/** Derived from the flight: planned before the start, ended after the end, paused when pausedAt is set. */
	status: CampaignStatus;
	/** Midnight that starts the first day of the flight. */
	startAt: string;
	/** 23:59 of the last day of the flight. */
	endAt: string;
	/** When the team paused the campaign, or null. No spend follows this time. */
	pausedAt: string | null;
	/** The money approved for the whole flight, in whole units of CURRENCY. Spend never passes it. */
	budget: number;
	/** The channels of the media plan, in CHANNELS order. */
	channels: Channel[];
	ownerId: string;
	/** The audience segments that the campaign targets. Each one belongs to the same client. */
	audienceIds: string[];
	/** One sentence of the brief: what the campaign says, and to whom. */
	brief: string;
};

/** The results of one campaign on one channel for one full day. Money is in whole units of CURRENCY, with cents. */
export type ChannelDayRow = MediaTotals & {
	campaignId: string;
	channel: Channel;
	/** Days from today: -1 is yesterday. Today has no row until the day ends. */
	dayOffset: number;
};

/** One audience segment of a client. */
export type AudienceRow = {
	/** For example "aud-07". The audience panel opens with `?audience=<id>`. */
	id: string;
	name: string;
	client: string;
	type: AudienceType;
	/** How the platform builds the segment, in one sentence. */
	definition: string;
	/** People in the segment for each of the last 90 days, oldest first. The last value is today. */
	sizeByDay: number[];
	/** Share of reached people who clicked, saved, or replied in the last 30 days: 0.034 is 3.4 %. */
	engagementRate: number;
};

/** One item of the content calendar: a post, an ad, an email, or a video of one campaign. */
export type ContentItemRow = {
	/** For example "cnt-042", in the order of the time. */
	id: string;
	/** The working title: one topic of the campaign, for example "Refill in 30 seconds". */
	title: string;
	format: ContentFormat;
	campaignId: string;
	/** When the item goes out, as ISO. */
	scheduledAt: string;
	/** The stage of the item before it goes out. contentStatusOf (content.ts) turns a past item into "published". */
	stage: ContentStage;
	ownerId: string;
};

/** The kinds of event on the timeline of a campaign. */
export const CAMPAIGN_EVENT_KINDS = [
	"brief_approved",
	"launched",
	"audience_added",
	"creative_refreshed",
	"paused",
	"ended",
] as const;

/** One kind of campaign event. Its text is the message key `eventsHere.<kind>`. */
export type CampaignEventKind = (typeof CAMPAIGN_EVENT_KINDS)[number];

/** One event on the timeline of a campaign. Every event is in the past. */
export type CampaignEventRow = {
	id: string;
	campaignId: string;
	kind: CampaignEventKind;
	occurredAt: string;
	/** The audience of an "audience_added" event, else null. */
	audienceId: string | null;
	/** The team member who did it. */
	actorId: string;
};

/** Every sample table. The query files sort, filter, and join them. */
export type SampleTables = {
	/** The midnight that starts today, in milliseconds since 1970. No result row is newer than it. */
	dayStart: number;
	team: TeamMemberRow[];
	campaigns: CampaignRow[];
	channelDays: ChannelDayRow[];
	audiences: AudienceRow[];
	contentItems: ContentItemRow[];
	campaignEvents: CampaignEventRow[];
};

// Days of channel results before today. 90 days of charts plus the 90 days before them for the deltas.
const HISTORY_DAYS = 180;

const TEAM: TeamMemberRow[] = [
	{ id: "tm-1", name: "Ines Calloway", role: "Paid media lead" },
	{ id: "tm-2", name: "Theo Marchetti", role: "Performance strategist" },
	{ id: "tm-3", name: "Ada Lindqvist", role: "Social lead" },
	{ id: "tm-4", name: "Rafael Duarte", role: "CRM and email" },
	{ id: "tm-5", name: "June Whitaker", role: "Content producer" },
	{ id: "tm-6", name: "Samir Haddad", role: "Account director" },
];

/** The client brands. `orderValue` is the average value of one conversion, in whole units of CURRENCY. */
const CLIENTS = {
	kestrel: { name: "Kestrel Running", orderValue: 92 },
	tidewell: { name: "Tidewell Swim", orderValue: 68 },
	saltmarsh: { name: "Saltmarsh Gin", orderValue: 47 },
	brightfold: { name: "Brightfold Paper", orderValue: 36 },
	verano: { name: "Verano Home", orderValue: 118 },
	quillby: { name: "Quillby Books", orderValue: 29 },
	oakline: { name: "Oakline Cycles", orderValue: 154 },
	mirelle: { name: "Mirelle Skin", orderValue: 52 },
} as const;

type ClientKey = keyof typeof CLIENTS;

/** An audience before it gets an id and a history. `growth` is the change of size in 30 days: 0.06 is +6 %. */
type AudienceSeed = {
	client: ClientKey;
	name: string;
	type: AudienceType;
	definition: string;
	size: number;
	growth: number;
	engagementRate: number;
};

// The seeds stay grouped by client, in the order of CLIENTS: the table lists them in this order.
const AUDIENCES: AudienceSeed[] = [
	{
		client: "kestrel",
		name: "Trail runners, 25–44",
		type: "interest",
		definition:
			"People aged 25 to 44 who follow trail running, ultra races, or hiking gear.",
		size: 1_840_000,
		growth: 0.021,
		engagementRate: 0.019,
	},
	{
		client: "kestrel",
		name: "Past buyers, 12 months",
		type: "customer_list",
		definition:
			"Customers with an order in the last 12 months, from the store export of each Monday.",
		size: 46_200,
		growth: 0.038,
		engagementRate: 0.071,
	},
	{
		client: "kestrel",
		name: "Lookalike of past buyers, 1%",
		type: "lookalike",
		definition:
			"The 1% of adults in the market who are most like the past buyers list.",
		size: 2_310_000,
		growth: 0.004,
		engagementRate: 0.023,
	},
	{
		client: "kestrel",
		name: "Newsletter subscribers",
		type: "customer_list",
		definition:
			"People who opted in to the training tips email, from the store sign-up form.",
		size: 88_400,
		growth: 0.029,
		engagementRate: 0.058,
	},
	{
		client: "kestrel",
		name: "Race page visitors, 30 days",
		type: "retargeting",
		definition:
			"Visitors of a race shoe page in the last 30 days who did not buy.",
		size: 23_600,
		growth: -0.018,
		engagementRate: 0.044,
	},
	{
		client: "tidewell",
		name: "Pool and open-water swimmers",
		type: "interest",
		definition:
			"People who follow swim training, triathlon, or open-water events.",
		size: 960_000,
		growth: 0.016,
		engagementRate: 0.017,
	},
	{
		client: "tidewell",
		name: "Cart abandoners, 14 days",
		type: "retargeting",
		definition:
			"Visitors who put an item in the cart and left without an order in the last 14 days.",
		size: 7_900,
		growth: -0.064,
		engagementRate: 0.048,
	},
	{
		client: "tidewell",
		name: "Past buyers, 12 months",
		type: "customer_list",
		definition:
			"Customers with an order in the last 12 months, from the store export of each Monday.",
		size: 31_900,
		growth: 0.024,
		engagementRate: 0.066,
	},
	{
		client: "tidewell",
		name: "Lookalike of past buyers, 1%",
		type: "lookalike",
		definition:
			"The 1% of adults in the market who are most like the past buyers list.",
		size: 1_980_000,
		growth: 0.003,
		engagementRate: 0.019,
	},
	{
		client: "tidewell",
		name: "Swim school parents",
		type: "interest",
		definition:
			"Parents who follow swim lessons, kids sports clubs, or water safety topics.",
		size: 540_000,
		growth: 0.031,
		engagementRate: 0.024,
	},
	{
		client: "saltmarsh",
		name: "Cocktail enthusiasts, 25+",
		type: "interest",
		definition:
			"Adults aged 25 and over who follow cocktail recipes, home bars, or craft spirits.",
		size: 1_270_000,
		growth: 0.027,
		engagementRate: 0.021,
	},
	{
		client: "saltmarsh",
		name: "Bar and restaurant buyers",
		type: "customer_list",
		definition:
			"Trade contacts who order by the case, from the wholesale price list sign-ups.",
		size: 3_850,
		growth: 0.052,
		engagementRate: 0.089,
	},
	{
		client: "saltmarsh",
		name: "Lookalike of trade buyers, 2%",
		type: "lookalike",
		definition:
			"The 2% of adults in the market who are most like the bar and restaurant buyers.",
		size: 1_640_000,
		growth: 0.005,
		engagementRate: 0.018,
	},
	{
		client: "saltmarsh",
		name: "Site visitors, 30 days",
		type: "retargeting",
		definition:
			"Every visitor of the online shop in the last 30 days, except buyers of the last 7 days.",
		size: 19_200,
		growth: 0.067,
		engagementRate: 0.039,
	},
	{
		client: "saltmarsh",
		name: "Gift buyers, last season",
		type: "customer_list",
		definition:
			"Customers who sent a gift box in the last winter season, from the order export.",
		size: 8_700,
		growth: -0.012,
		engagementRate: 0.061,
	},
	{
		client: "brightfold",
		name: "Stationery and planner fans",
		type: "interest",
		definition:
			"People who follow journaling, fountain pens, planners, or desk setups.",
		size: 720_000,
		growth: 0.044,
		engagementRate: 0.026,
	},
	{
		client: "brightfold",
		name: "Site visitors, 30 days",
		type: "retargeting",
		definition:
			"Every visitor of the online shop in the last 30 days, except buyers of the last 7 days.",
		size: 58_400,
		growth: 0.118,
		engagementRate: 0.037,
	},
	{
		client: "brightfold",
		name: "Past buyers, 12 months",
		type: "customer_list",
		definition:
			"Customers with an order in the last 12 months, from the store export of each Monday.",
		size: 24_100,
		growth: 0.036,
		engagementRate: 0.069,
	},
	{
		client: "brightfold",
		name: "Lookalike of past buyers, 1%",
		type: "lookalike",
		definition:
			"The 1% of adults in the market who are most like the past buyers list.",
		size: 2_040_000,
		growth: 0.004,
		engagementRate: 0.021,
	},
	{
		client: "brightfold",
		name: "Students and teachers",
		type: "interest",
		definition:
			"People who follow study tips, school supplies, or classroom organization.",
		size: 1_380_000,
		growth: 0.058,
		engagementRate: 0.023,
	},
	{
		client: "verano",
		name: "New homeowners",
		type: "interest",
		definition:
			"People who moved home in the last 6 months or follow home renovation topics.",
		size: 2_060_000,
		growth: 0.012,
		engagementRate: 0.015,
	},
	{
		client: "verano",
		name: "Lookalike of top customers, 2%",
		type: "lookalike",
		definition:
			"The 2% of adults in the market who are most like the customers with three orders or more.",
		size: 3_480_000,
		growth: 0.002,
		engagementRate: 0.018,
	},
	{
		client: "verano",
		name: "Past buyers, 24 months",
		type: "customer_list",
		definition:
			"Customers with an order in the last 24 months, from the store export of each Monday.",
		size: 38_500,
		growth: 0.019,
		engagementRate: 0.062,
	},
	{
		client: "verano",
		name: "Cart abandoners, 14 days",
		type: "retargeting",
		definition:
			"Visitors who put an item in the cart and left without an order in the last 14 days.",
		size: 11_300,
		growth: -0.048,
		engagementRate: 0.046,
	},
	{
		client: "verano",
		name: "Garden and patio fans",
		type: "interest",
		definition:
			"People who follow garden design, patio furniture, or outdoor cooking.",
		size: 1_560_000,
		growth: 0.022,
		engagementRate: 0.017,
	},
	{
		client: "quillby",
		name: "Book club members",
		type: "customer_list",
		definition:
			"Members of the monthly book club, from the subscription list. Updated each night.",
		size: 18_700,
		growth: 0.061,
		engagementRate: 0.083,
	},
	{
		client: "quillby",
		name: "Mystery and crime readers",
		type: "interest",
		definition:
			"People who follow crime fiction authors, mystery podcasts, or book reviews.",
		size: 1_130_000,
		growth: 0.009,
		engagementRate: 0.022,
	},
	{
		client: "quillby",
		name: "Lookalike of club members, 1%",
		type: "lookalike",
		definition:
			"The 1% of adults in the market who are most like the book club members.",
		size: 1_870_000,
		growth: 0.007,
		engagementRate: 0.02,
	},
	{
		client: "quillby",
		name: "Cart abandoners, 7 days",
		type: "retargeting",
		definition:
			"Visitors who put a book in the cart and left without an order in the last 7 days.",
		size: 4_600,
		growth: -0.035,
		engagementRate: 0.051,
	},
	{
		client: "quillby",
		name: "Parents of young readers",
		type: "interest",
		definition:
			"Parents who follow picture books, reading lists for children, or school libraries.",
		size: 820_000,
		growth: 0.026,
		engagementRate: 0.025,
	},
	{
		client: "oakline",
		name: "Commuter cyclists",
		type: "interest",
		definition:
			"City residents who follow bike commuting, e-bikes, or cycle lanes in their area.",
		size: 640_000,
		growth: 0.034,
		engagementRate: 0.016,
	},
	{
		client: "oakline",
		name: "Video viewers, 75% watched",
		type: "retargeting",
		definition:
			"People who watched three quarters or more of a brand video in the last 60 days.",
		size: 41_300,
		growth: 0.092,
		engagementRate: 0.041,
	},
	{
		client: "oakline",
		name: "Past buyers, 24 months",
		type: "customer_list",
		definition:
			"Customers with a bike or a service order in the last 24 months, from the shop system.",
		size: 14_800,
		growth: 0.017,
		engagementRate: 0.073,
	},
	{
		client: "oakline",
		name: "Lookalike of past buyers, 1%",
		type: "lookalike",
		definition:
			"The 1% of adults in the market who are most like the past buyers list.",
		size: 1_720_000,
		growth: 0.003,
		engagementRate: 0.019,
	},
	{
		client: "oakline",
		name: "Gravel and touring riders",
		type: "interest",
		definition:
			"People who follow gravel races, bike packing, or long touring routes.",
		size: 430_000,
		growth: 0.049,
		engagementRate: 0.022,
	},
	{
		client: "mirelle",
		name: "Skincare subscribers",
		type: "customer_list",
		definition:
			"Customers with an active refill subscription, from the billing export of each morning.",
		size: 27_600,
		growth: 0.047,
		engagementRate: 0.064,
	},
	{
		client: "mirelle",
		name: "Lookalike of subscribers, 1%",
		type: "lookalike",
		definition:
			"The 1% of adults in the market who are most like the active subscribers.",
		size: 2_190_000,
		growth: 0.006,
		engagementRate: 0.024,
	},
	{
		client: "mirelle",
		name: "Product page visitors, 7 days",
		type: "retargeting",
		definition:
			"Visitors of a product page in the last 7 days who did not buy.",
		size: 12_400,
		growth: -0.021,
		engagementRate: 0.052,
	},
	{
		client: "mirelle",
		name: "Clean beauty followers",
		type: "interest",
		definition:
			"People who follow clean beauty creators, ingredient guides, or skin care routines.",
		size: 2_870_000,
		growth: 0.033,
		engagementRate: 0.02,
	},
	{
		client: "mirelle",
		name: "Lapsed subscribers, 90 days",
		type: "customer_list",
		definition:
			"Customers who stopped a refill subscription in the last 90 days, from the billing export.",
		size: 5_300,
		growth: 0.014,
		engagementRate: 0.038,
	},
];

/**
 * A campaign before it gets its dates. The offsets are days from today: -5 is five days ago.
 * `daily` is the planned spend per day. `pace` is how fast the team spends against that plan: 1.1 is 10 % faster.
 * `mix` gives the share of the spend per channel. `owner` and `audiences` are indexes into TEAM and AUDIENCES.
 */
type CampaignSeed = {
	client: ClientKey;
	name: string;
	objective: CampaignObjective;
	start: number;
	end: number;
	pausedOn?: number;
	daily: number;
	mix: Partial<Record<Channel, number>>;
	pace: number;
	owner: number;
	audiences: number[];
	brief: string;
	/**
	 * The subjects of the calendar items of this campaign. The items take them in turn.
	 * Empty for a flight that ended before the calendar window (CONTENT_WINDOW): it has no item.
	 */
	topics: string[];
};

// The order is the order of creation: the codes run from CMP-101 to CMP-132.
const CAMPAIGNS: CampaignSeed[] = [
	{
		client: "quillby",
		name: "Indie Picks",
		objective: "traffic",
		start: -178,
		end: -120,
		daily: 320,
		mix: { paid_social: 0.6, search: 0.4 },
		pace: 0.93,
		owner: 2,
		audiences: [26, 25, 27, 29, 28],
		brief:
			"Staff picks from independent presses, with a short review for each title.",
		topics: [],
	},
	{
		client: "saltmarsh",
		name: "Distillery Tours",
		objective: "leads",
		start: -170,
		end: -130,
		daily: 260,
		mix: { paid_social: 0.5, search: 0.3, email: 0.2 },
		pace: 0.95,
		owner: 0,
		audiences: [10, 11, 12, 13, 14],
		brief:
			"Tour bookings at the distillery, with a tasting of three gins at the end.",
		topics: [],
	},
	{
		client: "verano",
		name: "Outdoor Living Sale",
		objective: "sales",
		start: -160,
		end: -100,
		daily: 780,
		mix: { paid_social: 0.4, search: 0.4, email: 0.2 },
		pace: 0.96,
		owner: 1,
		audiences: [20, 21, 22, 24, 23],
		brief: "Garden chairs, lanterns, and outdoor textiles at 20% off.",
		topics: [],
	},
	{
		client: "kestrel",
		name: "Fresh Laces Drop",
		objective: "sales",
		start: -150,
		end: -95,
		daily: 640,
		mix: { paid_social: 0.5, email: 0.2, partners: 0.3 },
		pace: 0.94,
		owner: 2,
		audiences: [0, 2, 1, 3, 4],
		brief: "Four new colorways of the road shoe, shown by club runners.",
		topics: [],
	},
	{
		client: "oakline",
		name: "Gravel Days",
		objective: "awareness",
		start: -140,
		end: -85,
		daily: 520,
		mix: { paid_social: 0.4, video: 0.6 },
		pace: 0.92,
		owner: 4,
		audiences: [30, 31, 32, 34, 33],
		brief: "A video series of weekend gravel routes, filmed with local riders.",
		topics: [],
	},
	{
		client: "mirelle",
		name: "Sensitive Skin Edit",
		objective: "sales",
		start: -125,
		end: -70,
		daily: 700,
		mix: { paid_social: 0.45, search: 0.3, partners: 0.25 },
		pace: 0.97,
		owner: 1,
		audiences: [36, 37, 35, 38, 39],
		brief:
			"A routine of four fragrance-free products, explained by a dermatology nurse.",
		topics: [],
	},
	{
		client: "brightfold",
		name: "Letter Writing Week",
		objective: "traffic",
		start: -118,
		end: -64,
		daily: 240,
		mix: { paid_social: 0.5, email: 0.3, partners: 0.2 },
		pace: 0.9,
		owner: 3,
		audiences: [15, 16, 17, 19, 18],
		brief: "Prompts for one letter a day, with free envelope templates.",
		topics: [],
	},
	{
		client: "tidewell",
		name: "Goggle Bundle Push",
		objective: "sales",
		start: -110,
		end: -50,
		daily: 450,
		mix: { paid_social: 0.35, search: 0.5, email: 0.15 },
		pace: 0.95,
		owner: 0,
		audiences: [5, 6, 7, 8, 9],
		brief: "Two pairs of goggles and a case for the price of one pair.",
		topics: [],
	},
	{
		client: "quillby",
		name: "Author Q&A Series",
		objective: "awareness",
		start: -100,
		end: -42,
		daily: 280,
		mix: { paid_social: 0.3, email: 0.2, video: 0.5 },
		pace: 0.91,
		owner: 4,
		audiences: [25, 26, 27, 28, 29],
		brief: "Short filmed interviews with six authors of the spring list.",
		topics: [],
	},
	{
		client: "saltmarsh",
		name: "Tonic Pairings",
		objective: "sales",
		start: -90,
		end: -33,
		daily: 380,
		mix: { paid_social: 0.5, search: 0.2, partners: 0.3 },
		pace: 0.96,
		owner: 2,
		audiences: [10, 12, 13, 14, 11],
		brief: "A pairing card for each gin, with three tonics and a garnish.",
		topics: [
			"Three tonics, one gin",
			"Garnish guide",
			"Pairing card reveal",
			"Bartender's pick",
			"Summer spritz recipe",
		],
	},
	{
		client: "verano",
		name: "Ceramics Collab",
		objective: "sales",
		start: -75,
		end: -20,
		daily: 560,
		mix: { paid_social: 0.4, email: 0.2, partners: 0.4 },
		pace: 0.94,
		owner: 5,
		audiences: [21, 20, 22, 23, 24],
		brief: "A limited table set made with a studio potter, in 400 pieces.",
		topics: [
			"Studio visit with the potter",
			"Glaze color story",
			"Table set reveal",
			"Only 400 pieces",
			"Stoneware care guide",
		],
	},
	{
		client: "brightfold",
		name: "Notebook Refill Club",
		objective: "leads",
		start: -60,
		end: -8,
		daily: 300,
		mix: { paid_social: 0.2, search: 0.5, email: 0.3 },
		pace: 0.97,
		owner: 3,
		audiences: [15, 16, 18, 19, 17],
		brief: "Sign-ups for a refill every quarter, with the first one free.",
		topics: [
			"First refill free",
			"Paper weight explained",
			"How the club works",
			"Member desk setups",
			"Refill day reminder",
		],
	},
	{
		client: "kestrel",
		name: "Marathon Prep Club",
		objective: "leads",
		start: -84,
		end: 20,
		daily: 720,
		mix: { paid_social: 0.4, search: 0.3, email: 0.15, partners: 0.15 },
		pace: 1.02,
		owner: 0,
		audiences: [0, 1, 2, 3, 4],
		brief: "A free 16-week plan by email, with coach videos for the long runs.",
		topics: [
			"Long-run plan",
			"Fueling on long runs",
			"Pacing the long run",
			"Race-day checklist",
			"Taper week tips",
			"Recovery after 30K",
			"Shoe rotation for the plan",
			"Member finish times",
		],
	},
	{
		client: "mirelle",
		name: "Refill Pouches",
		objective: "sales",
		start: -72,
		end: 12,
		daily: 610,
		mix: { paid_social: 0.4, search: 0.35, email: 0.25 },
		pace: 1.12,
		owner: 1,
		audiences: [35, 37, 36, 38, 39],
		brief: "Refill pouches that use 70% less plastic than a new bottle.",
		topics: [
			"Refill in 30 seconds",
			"70% less plastic",
			"Pouch vs new bottle",
			"Recycle the pouch",
			"Subscriber refill offer",
			"Three scents, one pouch",
			"Refill station near you",
			"Bathroom shelf makeover",
		],
	},
	{
		client: "oakline",
		name: "Commute Better",
		objective: "awareness",
		start: -66,
		end: 40,
		daily: 880,
		mix: { paid_social: 0.3, search: 0.2, video: 0.5 },
		pace: 0.86,
		owner: 4,
		audiences: [30, 31, 32, 33, 34],
		brief:
			"Riders show their daily route and the time that they save against the car.",
		topics: [
			"Rider diaries",
			"Rain-proof kit",
			"Bike vs car, same route",
			"Parking at the office",
			"Night riding lights",
			"Office shower tips",
			"Commute in a suit",
			"Cargo bike school run",
		],
	},
	{
		client: "tidewell",
		name: "Swim Kit Refresh",
		objective: "sales",
		start: -55,
		end: 6,
		daily: 430,
		mix: { paid_social: 0.4, search: 0.45, email: 0.15 },
		pace: 1,
		owner: 0,
		audiences: [5, 6, 8, 9, 7],
		brief: "The new training range: suits, caps, and a mesh bag.",
		topics: [
			"New training suits",
			"Cap and goggle match",
			"Mesh bag giveaway",
			"Suit fit guide",
			"Coach's kit list",
		],
	},
	{
		client: "quillby",
		name: "Book Box Subscriptions",
		objective: "sales",
		start: -48,
		end: 30,
		daily: 390,
		mix: { paid_social: 0.5, search: 0.25, email: 0.25 },
		pace: 0.99,
		owner: 3,
		audiences: [25, 26, 27, 28, 29],
		brief: "A monthly box of two books and a tea, chosen by the shop staff.",
		topics: [
			"This month's box",
			"Tea of the month",
			"Staff picks unboxed",
			"Gift a box",
			"Reader reviews",
			"Meet the shop staff",
			"Past boxes, one shelf",
			"Cozy reading corner",
		],
	},
	{
		client: "verano",
		name: "First Home Guide",
		objective: "leads",
		start: -40,
		end: 50,
		daily: 650,
		mix: { paid_social: 0.35, search: 0.45, video: 0.2 },
		pace: 1.04,
		owner: 1,
		audiences: [20, 21, 23, 24, 22],
		brief:
			"A free guide to furnish a first home room by room, in exchange for an email.",
		topics: [
			"Room by room checklist",
			"Living room on a budget",
			"First home stories",
			"Free guide download",
			"Small kitchen ideas",
			"Moving day plan",
			"Hallway storage",
			"First guest room",
		],
	},
	{
		client: "saltmarsh",
		name: "Bartender Spotlight",
		objective: "awareness",
		start: -33,
		end: 18,
		daily: 340,
		mix: { paid_social: 0.2, video: 0.45, partners: 0.35 },
		pace: 1.15,
		owner: 2,
		audiences: [10, 11, 12, 13, 14],
		brief: "Five bartenders make their signature drink with the coastal gin.",
		topics: [
			"Signature serve",
			"Behind the bar",
			"Meet the bartenders",
			"Coastal gin sour",
			"Home bar tips",
			"Garnish masterclass",
			"Gin and tonic, three ways",
			"Glassware guide",
		],
	},
	{
		client: "brightfold",
		name: "Planner Pre-order",
		objective: "sales",
		start: -26,
		end: 34,
		daily: 520,
		mix: { paid_social: 0.45, search: 0.3, partners: 0.25 },
		pace: 0.97,
		owner: 5,
		audiences: [15, 16, 17, 18, 19],
		brief:
			"Pre-orders of next year's planner, with a free pen for the first 2,000.",
		topics: [
			"Next year's planner",
			"Free pen offer",
			"Inside the planner",
			"Pre-order perks",
			"Planner setup tips",
			"Monthly spread preview",
			"Paper and binding",
			"Planner color range",
		],
	},
	{
		client: "oakline",
		name: "E-bike Test Rides",
		objective: "leads",
		start: -19,
		end: 45,
		daily: 760,
		mix: { paid_social: 0.35, search: 0.45, email: 0.2 },
		pace: 1.01,
		owner: 0,
		audiences: [30, 31, 33, 34, 32],
		brief: "Bookings of a free 30-minute test ride at the three city stores.",
		topics: [
			"Book a 30-minute ride",
			"Three city stores",
			"E-bike range explained",
			"Rider first impressions",
			"Test ride reminder",
			"Hill climb test",
			"Charging at home",
			"Store team picks",
		],
	},
	{
		client: "mirelle",
		name: "Barrier Serum Launch",
		objective: "sales",
		start: -12,
		end: 27,
		daily: 1100,
		mix: { paid_social: 0.4, search: 0.15, video: 0.15, partners: 0.3 },
		pace: 1,
		owner: 1,
		audiences: [35, 36, 37, 39, 38],
		brief:
			"The launch of the barrier serum, with before-and-after results from 40 testers.",
		topics: [
			"Before and after: 40 testers",
			"Barrier repair explained",
			"How to layer the serum",
			"Dermatology nurse Q&A",
			"One week with the serum",
			"Ingredient list explained",
			"Morning and night routine",
			"Sensitive skin results",
		],
	},
	{
		client: "kestrel",
		name: "Trail Season Kickoff",
		objective: "sales",
		start: -5,
		end: 60,
		daily: 820,
		mix: { paid_social: 0.45, search: 0.25, video: 0.15, partners: 0.15 },
		pace: 0.88,
		owner: 2,
		audiences: [0, 2, 1, 3, 4],
		brief: "The trail shoe range and a route guide for six regional parks.",
		topics: [
			"Six-park route guide",
			"Trail shoe range",
			"Grip test on wet rock",
			"Park of the week",
			"Trail running basics",
			"Trail shoe fit guide",
			"Pack list for long trails",
			"Downhill technique",
		],
	},
	{
		client: "tidewell",
		name: "Open Water Series",
		objective: "awareness",
		start: -58,
		end: 15,
		pausedOn: -6,
		daily: 360,
		mix: { paid_social: 0.4, video: 0.6 },
		pace: 0.93,
		owner: 4,
		audiences: [5, 6, 7, 9, 8],
		brief: "Films of four open-water swims, with safety tips from a coach.",
		topics: [
			"The harbor swim",
			"Cold water safety",
			"Coach tips for sighting",
			"The lake swim",
			"Meet the swim coach",
		],
	},
	{
		client: "quillby",
		name: "Mystery Month",
		objective: "sales",
		start: -44,
		end: 22,
		pausedOn: -3,
		daily: 300,
		mix: { paid_social: 0.55, search: 0.45 },
		pace: 1,
		owner: 3,
		audiences: [26, 25, 28, 29, 27],
		brief: "Three crime novels for the price of two, all month.",
		topics: [
			"Three for two on crime",
			"Staff whodunit picks",
			"Cozy mysteries",
			"Debut crime authors",
			"Crime book club picks",
		],
	},
	{
		client: "saltmarsh",
		name: "Coastal Botanicals",
		objective: "sales",
		start: -30,
		end: 40,
		pausedOn: -11,
		daily: 410,
		mix: { paid_social: 0.5, search: 0.3, email: 0.2 },
		pace: 0.9,
		owner: 5,
		audiences: [10, 11, 12, 14, 13],
		brief: "The botanicals of the new gin, from the shore where they grow.",
		topics: [
			"From the shore",
			"Sea fennel and kelp",
			"The botanical harvest",
			"Tasting notes",
			"New gin, first pour",
		],
	},
	{
		client: "kestrel",
		name: "Run Club Referral",
		objective: "leads",
		start: 2,
		end: 40,
		daily: 280,
		mix: { paid_social: 0.5, email: 0.5 },
		pace: 1,
		owner: 3,
		audiences: [1, 0, 2, 3, 4],
		brief: "Members bring a friend to a club run, and both get socks.",
		topics: [
			"Bring a friend run",
			"Free socks for two",
			"Club run routes",
			"Referral reminder",
			"Member stories",
		],
	},
	{
		client: "oakline",
		name: "Service Plan Promo",
		objective: "sales",
		start: 5,
		end: 35,
		daily: 350,
		mix: { search: 0.6, email: 0.4 },
		pace: 1,
		owner: 0,
		audiences: [31, 30, 32, 33, 34],
		brief: "A yearly service plan with two tune-ups and free brake pads.",
		topics: [
			"Two tune-ups a year",
			"Free brake pads",
			"Service plan explained",
			"Book a tune-up",
			"Winter bike check",
		],
	},
	{
		client: "brightfold",
		name: "Back to the Desk",
		objective: "sales",
		start: 9,
		end: 60,
		daily: 480,
		mix: { paid_social: 0.5, search: 0.3, partners: 0.2 },
		pace: 1,
		owner: 5,
		audiences: [16, 15, 17, 18, 19],
		brief: "Desk sets for students and new office starters.",
		topics: [
			"Student desk set",
			"New starter kit",
			"Desk setup ideas",
			"Pens and paper pairing",
			"Office move checklist",
			"Student discount week",
			"Notebook bundle",
			"Cable tidy kit",
		],
	},
	{
		client: "verano",
		name: "Linen Edit",
		objective: "sales",
		start: 14,
		end: 44,
		daily: 600,
		mix: { paid_social: 0.5, email: 0.2, partners: 0.3 },
		pace: 1,
		owner: 2,
		audiences: [21, 20, 22, 23, 24],
		brief: "Washed linen bedding in six colors, shown in real homes.",
		topics: [
			"Washed linen, six colors",
			"Real homes, real beds",
			"Linen care guide",
			"Color story",
			"Sleep cooler in linen",
		],
	},
	{
		client: "mirelle",
		name: "Routine Quiz",
		objective: "leads",
		start: 21,
		end: 70,
		daily: 420,
		mix: { paid_social: 0.6, search: 0.4 },
		pace: 1,
		owner: 1,
		audiences: [36, 35, 37, 38, 39],
		brief:
			"A five-question quiz that gives a routine and a sample code by email.",
		topics: [
			"Take the routine quiz",
			"Five questions, one routine",
			"Your sample code",
			"Skin type guide",
			"Quiz results explained",
		],
	},
	{
		client: "tidewell",
		name: "Lane Two Launch",
		objective: "sales",
		start: 30,
		end: 75,
		daily: 700,
		mix: { paid_social: 0.4, search: 0.35, video: 0.25 },
		pace: 1,
		owner: 0,
		audiences: [5, 6, 7, 8, 9],
		brief: "The launch of the Lane Two suit for club and masters swimmers.",
		topics: [
			"Lane Two first look",
			"Masters swimmer test",
			"Club team orders",
			"Suit fit guide",
			"Lane Two in the pool",
		],
	},
];

/**
 * The media rates of each channel. `cpm` is the cost of 1,000 impressions, `ctr` the share of impressions
 * that get a click, `cvr` the share of clicks that convert. Email is cheap to send, video converts little.
 * The values keep the total return near 3 to 4 times the spend, as in a normal retail account.
 */
const CHANNEL_RATES = {
	paid_social: { cpm: 8.5, ctr: 0.012, cvr: 0.025 },
	search: { cpm: 80, ctr: 0.05, cvr: 0.055 },
	email: { cpm: 6, ctr: 0.02, cvr: 0.016 },
	video: { cpm: 18, ctr: 0.006, cvr: 0.02 },
	partners: { cpm: 14, ctr: 0.015, cvr: 0.028 },
} satisfies Record<Channel, { cpm: number; ctr: number; cvr: number }>;

/** How the objective changes the conversion rate: an awareness flight buys reach, a leads flight asks for an email. */
const OBJECTIVE_CONVERSION = {
	awareness: 0.45,
	traffic: 0.8,
	leads: 1.35,
	sales: 1,
} satisfies Record<CampaignObjective, number>;

/** Spend per weekday, Sunday first: the platforms deliver less on the weekend. */
const WEEKDAY_SPEND = [0.84, 1.04, 1.08, 1.06, 1.02, 0.95, 0.81];

/**
 * The chance per day that a campaign posts one item of a format on its channel.
 * About two items per working day across the live campaigns, so a month cell holds a few chips.
 */
const CONTENT_RATE = {
	social_post: 0.11,
	search_ad: 0.03,
	email: 0.045,
	video: 0.04,
	creator_post: 0.05,
} satisfies Record<ContentFormat, number>;

/** The calendar shows items from this many days ago to this many days ahead. */
const CONTENT_WINDOW = { past: 42, ahead: 45 };

/**
 * A small seeded generator (mulberry32): the same seed gives the same numbers, so every render shows the same rows.
 * It returns a function that gives a number from 0 (included) to 1 (excluded).
 */
function seededRandom(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let value = state;
		value = Math.imul(value ^ (value >>> 15), value | 1);
		value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
		return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
	};
}

// Money keeps cents. Counts are whole numbers.
function roundCents(value: number): number {
	return Math.round(value * 100) / 100;
}

// Status follows the flight, so a status and its dates never disagree.
function statusOf(seed: CampaignSeed): CampaignStatus {
	if (seed.start > 0) {
		return "planned";
	}
	if (seed.pausedOn !== undefined) {
		return "paused";
	}
	return seed.end < 0 ? "ended" : "live";
}

// The time `minutes` after midnight of the day `offset` days from today, as ISO.
function atDayTime(dayStart: number, offset: number, minutes: number): string {
	return new Date(
		shiftDays(dayStart, offset) + minutes * MINUTE_MS,
	).toISOString();
}

// The last day with spend: yesterday, the last day of the flight, or the day before the pause.
function lastSpendDay(seed: CampaignSeed): number {
	const pauseLimit =
		seed.pausedOn === undefined ? Number.POSITIVE_INFINITY : seed.pausedOn - 1;
	return Math.min(seed.end, -1, pauseLimit);
}

function buildChannelDays(
	dayStart: number,
	campaigns: CampaignRow[],
): ChannelDayRow[] {
	const random = seededRandom(20_611);
	const rows: ChannelDayRow[] = [];
	CAMPAIGNS.forEach((seed, index) => {
		const campaign = campaigns[index];
		if (!campaign) {
			return;
		}
		const orderValue = CLIENTS[seed.client].orderValue;
		const campaignRows: ChannelDayRow[] = [];
		const firstDay = Math.max(seed.start, -HISTORY_DAYS);
		for (let day = firstDay; day <= lastSpendDay(seed); day++) {
			const weekday = new Date(shiftDays(dayStart, day)).getDay();
			// A new campaign spends slowly while the platforms learn: 55 %, 75 %, then 90 % on its first days.
			const ramp = [0.55, 0.75, 0.9][day - seed.start] ?? 1;
			for (const channel of CHANNELS) {
				const share = seed.mix[channel];
				if (share === undefined) {
					continue;
				}
				const rates = CHANNEL_RATES[channel];
				// Each metric gets its own noise of about ±12 %, so the ratios move from day to day.
				const spend =
					seed.daily *
					share *
					seed.pace *
					ramp *
					(WEEKDAY_SPEND[weekday] ?? 1) *
					(0.88 + random() * 0.24);
				const impressions = Math.round(
					(spend / rates.cpm) * 1000 * (0.9 + random() * 0.2),
				);
				const clicks = Math.round(
					impressions * rates.ctr * (0.85 + random() * 0.3),
				);
				const conversions = Math.round(
					clicks *
						rates.cvr *
						OBJECTIVE_CONVERSION[seed.objective] *
						(0.8 + random() * 0.4),
				);
				campaignRows.push({
					campaignId: campaign.id,
					channel,
					dayOffset: day,
					spend: roundCents(spend),
					impressions,
					clicks,
					conversions,
					revenue: roundCents(
						conversions * orderValue * (0.85 + random() * 0.3),
					),
				});
			}
		}
		// The ad platforms stop at the budget. A fast campaign gets its spend scaled under the budget.
		const spent = campaignRows.reduce((sum, row) => sum + row.spend, 0);
		const cap = campaign.budget * 0.985;
		const scale = spent > cap ? cap / spent : 1;
		for (const row of campaignRows) {
			rows.push(
				scale === 1 ? row : { ...row, spend: roundCents(row.spend * scale) },
			);
		}
	});
	return rows;
}

function buildAudiences(): AudienceRow[] {
	const random = seededRandom(7_331);
	return AUDIENCES.map((seed, index) => {
		const sizeByDay: number[] = [];
		for (let day = -89; day <= 0; day++) {
			// Compound growth from 90 days ago to today, with a noise of ±0.4 %. Today is the exact size.
			const noise = day === 0 ? 1 : 0.996 + random() * 0.008;
			sizeByDay.push(
				Math.round(seed.size * (1 + seed.growth) ** (day / 30) * noise),
			);
		}
		return {
			id: `aud-${String(index + 1).padStart(2, "0")}`,
			name: seed.name,
			client: CLIENTS[seed.client].name,
			type: seed.type,
			definition: seed.definition,
			sizeByDay,
			engagementRate: seed.engagementRate,
		};
	});
}

/** A content item before it gets an id: the ids follow the order of the time. */
type ContentDraft = Omit<ContentItemRow, "id">;

function buildContentItems(
	dayStart: number,
	campaigns: CampaignRow[],
): ContentItemRow[] {
	const random = seededRandom(4_217);
	const drafts: ContentDraft[] = [];
	CAMPAIGNS.forEach((seed, index) => {
		const campaign = campaigns[index];
		if (!campaign) {
			return;
		}
		// The items of one campaign take its topics in time order. A topic comes back only after all the others.
		let topicTurn = 0;
		const firstDay = Math.max(seed.start, -CONTENT_WINDOW.past);
		// A paused campaign has no new content after the pause.
		const lastDay = Math.min(
			seed.end,
			CONTENT_WINDOW.ahead,
			seed.pausedOn === undefined ? Number.POSITIVE_INFINITY : seed.pausedOn,
		);
		for (let day = firstDay; day <= lastDay; day++) {
			const weekday = new Date(shiftDays(dayStart, day)).getDay();
			// The team publishes little on the weekend: 40 % of the weekday rate.
			const dayRate = weekday === 0 || weekday === 6 ? 0.4 : 1;
			for (const format of CONTENT_FORMATS) {
				if (seed.mix[CONTENT_FORMAT_CHANNEL[format]] === undefined) {
					continue;
				}
				if (random() >= CONTENT_RATE[format] * dayRate) {
					continue;
				}
				const title = seed.topics[topicTurn % seed.topics.length] ?? seed.name;
				topicTurn += 1;
				// Items go out between 08:00 and 17:30, on the hour or the half hour.
				const minutes = 8 * 60 + Math.floor(random() * 20) * 30;
				// The closer the day, the further the item is in the work. A past item keeps "scheduled".
				const roll = random();
				const stage: ContentStage =
					day <= 2
						? "scheduled"
						: day <= 9
							? roll < 0.55
								? "scheduled"
								: "in_review"
							: roll < 0.7
								? "drafting"
								: "in_review";
				// Two of three items belong to the campaign owner. The others go to the content producer.
				const ownerIndex = random() < 0.67 ? seed.owner : 4;
				drafts.push({
					title,
					format,
					campaignId: campaign.id,
					scheduledAt: atDayTime(dayStart, day, minutes),
					stage,
					ownerId: TEAM[ownerIndex]?.id ?? campaign.ownerId,
				});
			}
		}
	});
	drafts.sort(
		(first, second) =>
			Date.parse(first.scheduledAt) - Date.parse(second.scheduledAt),
	);
	return drafts.map((draft, index) => ({
		...draft,
		id: `cnt-${String(index + 1).padStart(3, "0")}`,
	}));
}

/** An event before it gets an id: the ids follow the order of the time. */
type EventDraft = Omit<CampaignEventRow, "id">;

function buildCampaignEvents(
	dayStart: number,
	campaigns: CampaignRow[],
	audiences: AudienceRow[],
): CampaignEventRow[] {
	const drafts: EventDraft[] = [];
	CAMPAIGNS.forEach((seed, index) => {
		const campaign = campaigns[index];
		if (!campaign) {
			return;
		}
		const owner = campaign.ownerId;
		const director = TEAM[5]?.id ?? owner;
		const push = (
			kind: CampaignEventKind,
			day: number,
			minutes: number,
			actorId: string,
			audienceId: string | null = null,
		) => {
			// Every event is in the past: only days before today get an event.
			if (day <= -1) {
				drafts.push({
					campaignId: campaign.id,
					kind,
					occurredAt: atDayTime(dayStart, day, minutes),
					audienceId,
					actorId,
				});
			}
		};
		// The account director approves the brief 12 to 16 days before the start.
		// A flight that starts later than that has no approved brief yet: push skips a future day.
		push(
			"brief_approved",
			seed.start - 12 - (index % 5),
			11 * 60 + 15,
			director,
		);
		push("launched", seed.start, 9 * 60, owner);
		const stopDay = Math.min(seed.end, seed.pausedOn ?? seed.end, -1);
		const second = seed.audiences[1];
		const secondAudience = second === undefined ? undefined : audiences[second];
		if (secondAudience) {
			const day = seed.start + Math.floor((stopDay - seed.start) / 2);
			if (day > seed.start) {
				push("audience_added", day, 14 * 60 + 40, owner, secondAudience.id);
			}
		}
		// The content producer refreshes the creative every three weeks, while the flight still runs.
		for (let day = seed.start + 21; day < stopDay; day += 21) {
			push("creative_refreshed", day, 10 * 60 + 5, TEAM[4]?.id ?? owner);
		}
		if (seed.pausedOn !== undefined) {
			push("paused", seed.pausedOn, 16 * 60 + 20, owner);
		}
		if (seed.end < 0) {
			push("ended", seed.end, 23 * 60 + 59, owner);
		}
	});
	drafts.sort(
		(first, second) =>
			Date.parse(first.occurredAt) - Date.parse(second.occurredAt),
	);
	return drafts.map((draft, index) => ({ ...draft, id: `evt-${index + 1}` }));
}

function buildTables(dayStart: number): SampleTables {
	const audiences = buildAudiences();
	const campaigns = CAMPAIGNS.map((seed, index): CampaignRow => {
		const number = 101 + index;
		const flightDays = seed.end - seed.start + 1;
		return {
			id: `cmp-${number}`,
			code: `CMP-${number}`,
			name: seed.name,
			client: CLIENTS[seed.client].name,
			objective: seed.objective,
			status: statusOf(seed),
			startAt: atDayTime(dayStart, seed.start, 0),
			endAt: atDayTime(dayStart, seed.end, 23 * 60 + 59),
			pausedAt:
				seed.pausedOn === undefined
					? null
					: atDayTime(dayStart, seed.pausedOn, 16 * 60 + 20),
			// The approved budget is the planned daily spend over the flight, rounded to 500.
			budget: Math.round((seed.daily * flightDays) / 500) * 500,
			channels: CHANNELS.filter((channel) => seed.mix[channel] !== undefined),
			ownerId: TEAM[seed.owner]?.id ?? "tm-1",
			audienceIds: seed.audiences.flatMap((audienceIndex) => {
				const audience = audiences[audienceIndex];
				return audience ? [audience.id] : [];
			}),
			brief: seed.brief,
		};
	});
	return {
		dayStart,
		team: TEAM,
		campaigns,
		channelDays: buildChannelDays(dayStart, campaigns),
		audiences,
		contentItems: buildContentItems(dayStart, campaigns),
		campaignEvents: buildCampaignEvents(dayStart, campaigns, audiences),
	};
}

// The tables of the current day. A new day builds them again, so the dates stay relative to today.
let cached: SampleTables | null = null;

/** The sample tables for `now` (milliseconds since 1970). The same day returns the same object. */
export function getSampleTables(now: number = Date.now()): SampleTables {
	const dayStart = startOfLocalDay(now);
	if (cached?.dayStart !== dayStart) {
		cached = buildTables(dayStart);
	}
	return cached;
}

/** The team member of `id`. The sample tables always hold the owner of a row, so a miss is a broken table. */
export function memberName(tables: SampleTables, id: string): string {
	return tables.team.find((member) => member.id === id)?.name ?? id;
}
