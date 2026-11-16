// The categories of the ledger and the monthly budgets of the expense categories.
// The sample transactions, the budgets page, and the category filter read this file.
// To make it real: the two lists become the tables `categories` and `budgets`.

/** Every category id. Its label is the message key `categories.<id>`. `transfer` marks a move between two accounts. */
export const CATEGORY_IDS = [
	"client_projects",
	"retainers",
	"workshops",
	"other_income",
	"payroll",
	"rent",
	"contractors",
	"software",
	"marketing",
	"travel",
	"supplies",
	"equipment",
	"insurance",
	"taxes",
	"transfer",
] as const;

/** One category id. */
export type CategoryId = (typeof CATEGORY_IDS)[number];

/** The monthly limit of one expense category. */
export type Budget = {
	categoryId: CategoryId;
	/** The limit of one calendar month, in cents. */
	limitCents: number;
	/** `fixed`: the same bills each month, so the pace of the month does not judge it. `variable`: the team decides each spend. */
	rhythm: "fixed" | "variable";
};

// The limits sit near the usual spend of the sample studio, so some months go over.
const BUDGETS: readonly Budget[] = [
	{ categoryId: "payroll", limitCents: 2_100_000, rhythm: "fixed" },
	{ categoryId: "rent", limitCents: 420_000, rhythm: "fixed" },
	{ categoryId: "contractors", limitCents: 400_000, rhythm: "variable" },
	{ categoryId: "marketing", limitCents: 100_000, rhythm: "variable" },
	{ categoryId: "software", limitCents: 100_000, rhythm: "fixed" },
	{ categoryId: "travel", limitCents: 70_000, rhythm: "variable" },
	{ categoryId: "equipment", limitCents: 60_000, rhythm: "variable" },
	{ categoryId: "insurance", limitCents: 50_000, rhythm: "fixed" },
	{ categoryId: "supplies", limitCents: 45_000, rhythm: "variable" },
];

/** The monthly budgets, the largest limit first. Taxes have no budget: the tax reserve pays them. */
export function listBudgets(): Budget[] {
	return [...BUDGETS];
}
