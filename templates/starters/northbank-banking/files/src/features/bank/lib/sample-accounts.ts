// The sample accounts of the business customer: one operating account, one payroll account, one tax reserve.
// It stands in for an `accounts` table. sample-transactions.ts books every entry on one of these ids.
// The statements page shows each account, and the transaction tables show its name and number ending.

/** The currency of every amount in the portal. A settings table can hold it later. */
export const BANK_CURRENCY = "USD";

/** The name of the business that signs in. The page headers show it. */
export const CUSTOMER_NAME = "Larchmont Joinery Co.";

/** The ids of the accounts, in the order of the pages. */
export const ACCOUNT_IDS = ["operating", "payroll", "reserve"] as const;

/** One account id. Its label is the message key `accounts.<id>`. */
export type AccountId = (typeof ACCOUNT_IDS)[number];

/** One account of the customer. */
export type Account = {
	id: AccountId;
	/** "checking" pays the bills; "savings" earns interest and pays the taxes. */
	type: "checking" | "savings";
	/** The last 4 digits of the account number. The full number never shows. */
	numberEnding: string;
	/** Balance in cents at the start of the sample history (sample-transactions.ts, HISTORY_DAYS). */
	openingBalanceCents: number;
};

// The three accounts by id. The numbers are fictional.
const ACCOUNT_BY_ID = {
	operating: {
		id: "operating",
		type: "checking",
		numberEnding: "4821",
		openingBalanceCents: 11_840_000,
	},
	payroll: {
		id: "payroll",
		type: "checking",
		numberEnding: "5590",
		openingBalanceCents: 920_000,
	},
	reserve: {
		id: "reserve",
		type: "savings",
		numberEnding: "7736",
		openingBalanceCents: 3_150_000,
	},
} satisfies Record<AccountId, Account>;

/** The three accounts, in the order of ACCOUNT_IDS. */
export const ACCOUNTS: readonly Account[] = ACCOUNT_IDS.map(
	(id) => ACCOUNT_BY_ID[id],
);

/** One account by id. The type of `id` makes the lookup total. */
export function accountOf(id: AccountId): Account {
	return ACCOUNT_BY_ID[id];
}
