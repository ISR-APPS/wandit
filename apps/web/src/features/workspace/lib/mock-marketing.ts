// Mock marketing plan for the Marketing tab — deterministic per project so
// the tab reads coherently across visits. When the real generation lands
// this becomes an artifact produced by the queue (strategy doc, PRD §1) and
// this file is replaced by the services layer, same as mock-pages.

export type ChannelSlice = {
	key: string;
	name: string;
	share: number;
	note: string;
	barClass: string;
};

export type AudiencePersona = {
	key: string;
	name: string;
	ageRange: string;
	description: string;
	platforms: string[];
};

export type ChecklistItemState = "done" | "current" | "todo";

export type ChecklistItem = {
	key: string;
	label: string;
	detail?: string;
	state: ChecklistItemState;
	/** Deep link into a workspace tab, rendered as a small action button. */
	linkTab?: "assets" | "leads";
};

export type IdeaStatus = "ready" | "draft" | "idea";

export type CampaignIdea = {
	key: string;
	name: string;
	detail: string;
	platform: string;
	status: IdeaStatus;
};

export type MarketingPlan = {
	goal: string;
	goalTarget: number;
	take: string;
	channels: ChannelSlice[];
	personas: AudiencePersona[];
	checklist: ChecklistItem[];
	ideas: CampaignIdea[];
};

/** Round a lead-book-derived target to something that reads like a goal. */
function goalTargetFor(leadCount: number): number {
	const rough = Math.max(20, Math.round((leadCount * 0.6) / 10) * 10);
	return rough;
}

export function getMarketingPlan(project: {
	name: string;
	leadCount: number;
}): MarketingPlan {
	const goalTarget = goalTargetFor(project.leadCount);
	return {
		goal: `Reach ${goalTarget} confirmed orders this month`,
		goalTarget,
		take: `Don't spread the budget thin. Your page already converts — put every paid dinar into the Meta free-delivery offer until a lead costs under 300 DA, and post the ${project.name} demo on TikTok for free before boosting anything.`,
		channels: [
			{
				key: "meta",
				name: "Facebook + Instagram",
				share: 60,
				note: "Lead ads to 25–45s in the wilayas that already order — from 1 500 DA/day.",
				barClass: "bg-primary",
			},
			{
				key: "tiktok",
				name: "TikTok",
				share: 25,
				note: "Organic first — post the product demo. Boost only the hook that lands.",
				barClass: "bg-foreground",
			},
			{
				key: "whatsapp",
				name: "WhatsApp follow-up",
				share: 15,
				note: "Free. Relance every to-confirm lead within 24h — confirmed orders ship faster.",
				barClass: "bg-success",
			},
		],
		personas: [
			{
				key: "impulse",
				name: "Mobile-first impulse buyers",
				ageRange: "18–34",
				description:
					"Scroll TikTok at night and order on the first tap when the offer feels limited.",
				platforms: ["TIKTOK", "REELS"],
			},
			{
				key: "careful",
				name: "Careful COD shoppers",
				ageRange: "25–45",
				description:
					"Compare prices in Facebook groups; need reviews and cash-on-delivery reassurance before ordering.",
				platforms: ["FACEBOOK", "INSTAGRAM"],
			},
		],
		checklist: [
			{
				key: "publish",
				label: "Publish your page",
				state: "done",
			},
			{
				key: "creatives",
				label: "Generate ad creatives",
				state: "done",
				linkTab: "assets",
			},
			{
				key: "meta-campaign",
				label: "Launch your first Meta campaign",
				detail: "Free-delivery offer · 1 500 DA/day to start",
				state: "current",
			},
			{
				key: "tiktok-post",
				label: "Post the product demo on TikTok",
				detail: "Organic first — no spend yet",
				state: "todo",
			},
			{
				key: "confirm-leads",
				label: "Confirm your new leads by phone",
				state: "todo",
				linkTab: "leads",
			},
		],
		ideas: [
			{
				key: "free-delivery",
				name: "Free-delivery lead ads",
				detail: "Meta lead form · target the wilayas with confirmed orders",
				platform: "META",
				status: "ready",
			},
			{
				key: "unboxing-hooks",
				name: "Unboxing hook variations",
				detail: "Cut the demo into 3 openers, post 3 days apart",
				platform: "TIKTOK",
				status: "draft",
			},
			{
				key: "winback",
				name: "Win-back WhatsApp blast",
				detail: "One message to every cancelled lead · -10% code",
				platform: "WHATSAPP",
				status: "idea",
			},
		],
	};
}

/** Plain-markdown export of the plan — mirrors the leads CSV export. */
export function buildMarketingPlanMarkdown(
	plan: MarketingPlan,
	projectName: string,
	confirmedCount: number,
): string {
	const lines: string[] = [
		`# Marketing plan — ${projectName}`,
		"",
		"## Goal",
		`${plan.goal} (${confirmedCount} / ${plan.goalTarget})`,
		"",
		"## This week",
		plan.take,
		"",
		"## Where to spend",
		...plan.channels.map(
			(channel) => `- **${channel.name} — ${channel.share}%**: ${channel.note}`,
		),
		"",
		`## Who you're talking to`,
		...plan.personas.map(
			(persona) =>
				`- **${persona.name} (${persona.ageRange})** — ${persona.description} [${persona.platforms.join(", ")}]`,
		),
		"",
		"## Week-1 checklist",
		...plan.checklist.map(
			(item) =>
				`- [${item.state === "done" ? "x" : " "}] ${item.label}${item.detail ? ` — ${item.detail}` : ""}`,
		),
		"",
		"## Campaign ideas",
		...plan.ideas.map(
			(idea) =>
				`- **${idea.name}** (${idea.platform}, ${idea.status}) — ${idea.detail}`,
		),
		"",
	];
	return lines.join("\n");
}
