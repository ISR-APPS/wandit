// Shapes of the home data: the category points of the cash flow strip and the KPI items of the totals line.
// overview.queries.ts builds them from the sample ledger. The strip and the totals line take the types.

/** The two parts of one bar of the strip. The label is the message key `overview.<category>`. */
export type CashFlowCategory = "moneyIn" | "moneyOut";

/** One day and one category of the strip. Every day has a row for both categories. */
export type CategoryPoint = {
	/** `YYYY-MM-DD`. */
	day: string;
	category: CashFlowCategory;
	/** In cents, never negative. Zero on a day with no entry. */
	value: number;
};

/** One KPI figure of the home. */
export type KpiItem = {
	/** Stable id, also the React key, for example "income". */
	id: string;
	/** Label, already translated. */
	label: string;
	/** A money figure in cents. */
	value: number;
	/** Ratio against the 30 days before: 0.12 is +12 %. null hides the delta. */
	change: number | null;
	/** "down" for expenses and for the card debt: a fall is good news. */
	goodWhen: "up" | "down";
};
