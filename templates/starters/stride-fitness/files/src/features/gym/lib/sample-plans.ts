// The membership plans of the gym. This module stands in for a `plans` table.
// The members module, the booking rules, and the plans page read it through ~/features/gym.
// The prices are sample prices of a fictional gym, in PLAN_CURRENCY.

/** Every plan id, in the order of the plans page. */
export const PLAN_IDS = [
	"unlimited",
	"annual",
	"eight",
	"off-peak",
	"student",
] as const;

/** One plan id. It is also the key of the plan in a URL filter. */
export type PlanId = (typeof PLAN_IDS)[number];

/** ISO 4217 code of every price. One gym bills in one currency. */
export const PLAN_CURRENCY = "USD";

/** One membership plan. */
export type Plan = {
	id: PlanId;
	/** The name on the plan card and in the member lists. Data, not a UI text. */
	name: string;
	/** One short line about what the plan gives. Data, not a UI text. */
	summary: string;
	/** The price of one billing period, in whole units of PLAN_CURRENCY. */
	price: number;
	/** How often the member pays `price`. */
	billing: "month" | "year";
	/** Classes included per calendar month. null means no limit. */
	classesPerMonth: number | null;
	/** "off-peak" books only weekday classes from 10:00 to 16:00, and every weekend class. */
	access: "all" | "off-peak";
};

/** The five plans. The plans page shows them in this order. */
export const PLANS: readonly Plan[] = [
	{
		id: "unlimited",
		name: "Unlimited",
		summary: "Every class and open gym, seven days a week.",
		price: 89,
		billing: "month",
		classesPerMonth: null,
		access: "all",
	},
	{
		id: "annual",
		name: "Annual Unlimited",
		summary: "Unlimited for a year, paid once. Two months free.",
		price: 890,
		billing: "year",
		classesPerMonth: null,
		access: "all",
	},
	{
		id: "eight",
		name: "Eight a Month",
		summary: "Eight classes each month, any time slot.",
		price: 59,
		billing: "month",
		classesPerMonth: 8,
		access: "all",
	},
	{
		id: "off-peak",
		name: "Off-Peak",
		summary: "Classes at quiet hours, for less.",
		price: 55,
		billing: "month",
		classesPerMonth: null,
		access: "off-peak",
	},
	{
		id: "student",
		name: "Student",
		summary: "Off-peak hours at a student price. Card checked at sign-up.",
		price: 39,
		billing: "month",
		classesPerMonth: null,
		access: "off-peak",
	},
];

// 12 months in a year: an annual price counts as one twelfth per month.
const MONTHS_PER_YEAR = 12;

/** The plan of an id. Every PlanId has a row in PLANS, so the result is never undefined. */
export function planOf(id: PlanId): Plan {
	const plan = PLANS.find((row) => row.id === id);
	if (!plan) {
		throw new Error(`Unknown plan id: ${id}`);
	}
	return plan;
}

/** The monthly value of one plan, in whole units of PLAN_CURRENCY. An annual plan counts one twelfth. */
export function monthlyValueOf(plan: Plan): number {
	return plan.billing === "year" ? plan.price / MONTHS_PER_YEAR : plan.price;
}
