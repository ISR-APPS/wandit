// The math of the statements pages: one statement per account and month, and the detail of one statement
// with its lines and the running balance.
// statements.queries.ts calls these pure functions. Each closing equals opening + money in - money out.
import {
	ACCOUNTS,
	type AccountId,
	addDays,
	addMonths,
	countsInBalance,
	type DailyBalance,
	daysBetween,
	monthEndOf,
	monthStartOf,
	STATEMENT_MONTHS,
	type Transaction,
} from "~/features/bank";

/** "open" is the month of today, still in progress. "closed" is a final statement. */
export type StatementStatus = "open" | "closed";

/** One statement of one account for one calendar month. Amounts are cents; money out is positive. */
export type Statement = {
	/** `<account>-<YYYY-MM>`, for example "operating-2026-10". Also the `$statementId` of the URL. */
	id: string;
	accountId: AccountId;
	/** The first day of the month, `YYYY-MM-01`. */
	month: string;
	/** The last day of the statement: the month end, or today for the open month. */
	endDay: string;
	status: StatementStatus;
	openingCents: number;
	moneyInCents: number;
	moneyOutCents: number;
	closingCents: number;
	/** The count of entries that changed the balance in the month. */
	lineCount: number;
};

/** One line of a statement: the entry and the balance of the account right after it. */
export type StatementLine = Transaction & { balanceAfterCents: number };

/** Everything the statement page shows. */
export type StatementDetail = {
	statement: Statement;
	/** The entries of the month, oldest first, each with the running balance. */
	lines: StatementLine[];
};

// The end-of-day balance of one account. A day before the history gives the opening balance.
function balanceOn(
	balances: DailyBalance[],
	accountId: AccountId,
	day: string,
): number {
	const first = balances[0];
	const account = ACCOUNTS.find((item) => item.id === accountId);
	if (!first || daysBetween(first.day, day) < 0) {
		return account?.openingBalanceCents ?? 0;
	}
	const index = Math.min(daysBetween(first.day, day), balances.length - 1);
	return balances[index]?.byAccount[accountId] ?? 0;
}

// The entries of one account in one month that changed the balance, oldest first.
function linesOf(
	rows: Transaction[],
	accountId: AccountId,
	month: string,
	endDay: string,
): Transaction[] {
	return rows
		.filter(
			(row) =>
				row.accountId === accountId &&
				row.day >= month &&
				row.day <= endDay &&
				countsInBalance(row),
		)
		.sort((first, second) => first.id.localeCompare(second.id));
}

function statementOf(
	rows: Transaction[],
	balances: DailyBalance[],
	accountId: AccountId,
	month: string,
	today: string,
): Statement {
	const isOpen = month === monthStartOf(today);
	const endDay = isOpen ? today : monthEndOf(month);
	const lines = linesOf(rows, accountId, month, endDay);
	const moneyInCents = lines
		.filter((row) => row.amountCents > 0)
		.reduce((sum, row) => sum + row.amountCents, 0);
	// Subtracting the negative entries from 0 gives a positive total and never "-0".
	const moneyOutCents = lines
		.filter((row) => row.amountCents < 0)
		.reduce((sum, row) => sum - row.amountCents, 0);
	const openingCents = balanceOn(balances, accountId, addDays(month, -1));
	return {
		id: `${accountId}-${month.slice(0, 7)}`,
		accountId,
		month,
		endDay,
		status: isOpen ? "open" : "closed",
		openingCents,
		moneyInCents,
		moneyOutCents,
		closingCents: openingCents + moneyInCents - moneyOutCents,
		lineCount: lines.length,
	};
}

/** Every statement, newest month first, then in the order of ACCOUNTS. `rows` is every entry. */
export function buildStatements(
	rows: Transaction[],
	balances: DailyBalance[],
	today: string,
): Statement[] {
	const thisMonth = monthStartOf(today);
	const statements: Statement[] = [];
	for (let offset = 0; offset < STATEMENT_MONTHS; offset += 1) {
		const month = addMonths(thisMonth, -offset);
		for (const account of ACCOUNTS) {
			statements.push(statementOf(rows, balances, account.id, month, today));
		}
	}
	return statements;
}

/** The statement `id` with its lines, or null for an unknown id. */
export function buildStatementDetail(
	rows: Transaction[],
	balances: DailyBalance[],
	today: string,
	id: string,
): StatementDetail | null {
	const statement = buildStatements(rows, balances, today).find(
		(item) => item.id === id,
	);
	if (!statement) {
		return null;
	}
	const { accountId, month, endDay } = statement;
	let running = statement.openingCents;
	const lines = linesOf(rows, accountId, month, endDay).map((row) => {
		running += row.amountCents;
		return { ...row, balanceAfterCents: running };
	});
	return { statement, lines };
}
