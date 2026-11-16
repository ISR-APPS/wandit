// The four accounts of the sample studio: a checking account, a savings account, a credit card, and the cash box.
// sample-transactions.ts books every row on one of them. The accounts pages read them through accounts.queries.ts.
// To make it real: this list becomes the table `accounts`.

/** The currency of every amount in the app (ISO 4217). Amounts are whole cents of it. */
export const LEDGER_CURRENCY = "USD";

/** Every account id. The id is also the `$accountId` part of the URL. */
export const ACCOUNT_IDS = [
	"operating",
	"tax-reserve",
	"card",
	"petty-cash",
] as const;

/** One account id. */
export type AccountId = (typeof ACCOUNT_IDS)[number];

/** The kinds of account. The label is the message key `accountTypes.<type>`. */
export type AccountType = "checking" | "savings" | "credit_card" | "cash";

/** One row of `accounts`. */
export type Account = {
	id: AccountId;
	/** The name that the team gave to the account. */
	name: string;
	/** The bank or the card company. null for the cash box. */
	institution: string | null;
	type: AccountType;
	/** The last four digits of the account or card number. null for the cash box. */
	numberEnding: string | null;
	/** The day the account was opened, as `YYYY-MM-DD`. */
	openedDay: string;
	/** The credit limit of a card, in cents. null for every other account. */
	creditLimitCents: number | null;
};

const ACCOUNTS: readonly Account[] = [
	{
		id: "operating",
		name: "Operating account",
		institution: "Northquay Bank",
		type: "checking",
		numberEnding: "4821",
		openedDay: "2019-03-11",
		creditLimitCents: null,
	},
	{
		id: "tax-reserve",
		name: "Tax reserve",
		institution: "Northquay Bank",
		type: "savings",
		numberEnding: "7730",
		openedDay: "2019-06-03",
		creditLimitCents: null,
	},
	{
		id: "card",
		name: "Business card",
		institution: "Calder Card Services",
		type: "credit_card",
		numberEnding: "0192",
		openedDay: "2020-01-20",
		creditLimitCents: 1_500_000,
	},
	{
		id: "petty-cash",
		name: "Petty cash",
		institution: null,
		type: "cash",
		numberEnding: null,
		openedDay: "2019-03-11",
		creditLimitCents: null,
	},
];

/** The four accounts, the main account first. */
export function listAccounts(): Account[] {
	return [...ACCOUNTS];
}

/** The name of one account. Every id of ACCOUNT_IDS has a row, so the fallback never shows. */
export function accountNameOf(id: AccountId): string {
	return ACCOUNTS.find((account) => account.id === id)?.name ?? id;
}
