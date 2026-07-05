// Mock conversation matching the dark prototype's "Montre Vintage COD" chat.
// Simulated backend output — deliberately NOT localized (docs/localization.md).

export type MockUserMessage = {
	id: string;
	role: "user";
	text: string;
};

export type MockArtifact = {
	title: string;
	meta: string;
};

export type MockAssistantMessage = {
	id: string;
	role: "assistant";
	thoughtLabel?: string;
	text: string;
	artifact?: MockArtifact;
};

export type MockUpdateMessage = {
	id: string;
	role: "update";
	text: string;
	linkLabel: string;
};

export type MockChatMessage =
	| MockUserMessage
	| MockAssistantMessage
	| MockUpdateMessage;

export type MockThread = {
	dateLabel: string;
	messages: MockChatMessage[];
	suggestions: string[];
};

export const MOCK_THREADS: Record<string, MockThread> = {
	"montre-vintage-cod": {
		dateLabel: "Today at 9:41",
		messages: [
			{
				id: "u1",
				role: "user",
				text: "Page de vente COD pour une montre vintage homme — livraison 58 wilayas, paiement à la livraison.",
			},
			{
				id: "a1",
				role: "assistant",
				thoughtLabel: "Thought for 12s",
				text: "Built your sales page — hero with the watch shot, three benefit blocks, a sticky COD order form with wilaya & commune selects, and an FR/AR language toggle. Mobile-first, ready to publish.",
				artifact: {
					title: "Sales page — Montre Vintage",
					meta: "v3 · FR & AR · COD form",
				},
			},
			{
				id: "u2",
				role: "user",
				text: "Add a launch offer −20% and an urgency countdown",
			},
			{
				id: "a2",
				role: "assistant",
				text: "Done — countdown pinned under the price, −20% badge in the hero, price updated to 4 900 DA. That's v4.",
			},
			{
				id: "up1",
				role: "update",
				text: "Sales page updated to v4",
				linkLabel: "Preview",
			},
		],
		suggestions: [
			"Generate TikTok creatives",
			"Translate to Arabic",
			"Add reviews section",
		],
	},
};
