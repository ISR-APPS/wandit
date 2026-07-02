export const SIGNUP_GRANT = 100;

export const CREDIT_COSTS = {
	generation: 10,
	chatMessage: 1,
} as const;

export type CreditAction = keyof typeof CREDIT_COSTS;

const ACTION_LABELS: Record<CreditAction, string> = {
	generation: "Generate",
	chatMessage: "Send",
};

/** priceTag("generation") → "Generate — 10 credits" */
export function priceTag(action: CreditAction): string {
	const cost = CREDIT_COSTS[action];
	return `${ACTION_LABELS[action]} — ${cost} ${cost === 1 ? "credit" : "credits"}`;
}

export const CREDITS_COPY = {
	chipAriaLabel: "Credits balance",
	balanceLabel: "Credits",
	usageOf: (balance: number, grant: number) => `${balance} of ${grant} left`,
	recentActivity: "Recent activity",
	emptyLedger: "No activity yet.",
	topUpChip: "Top up — coming soon",
	topUpDialog: "Top-up coming soon",
	insufficientTitle: "Not enough credits",
	insufficientBody:
		"This action costs more than you have left. Top-ups are on the way.",
	costLabel: "Cost",
	balanceRowLabel: "Your balance",
	seedGrantLabel: "Welcome grant",
} as const;
