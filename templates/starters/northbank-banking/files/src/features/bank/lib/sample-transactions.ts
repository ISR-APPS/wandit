// The sample entries of the three accounts for the last HISTORY_DAYS days, and the balance of each day.
// It stands in for a `transactions` table. Every query of the portal reads listTransactions or listDailyBalances.
// Each day seeds its own generator, so a day gives the same entries on every load and all day long.
import {
	addBankDays,
	addDays,
	bankDayOnOrAfter,
	bankDayOnOrBefore,
	dayNumberOf,
	dayPartsOf,
	daysBetween,
	monthEndOf,
} from "./bank-day";
import { ACCOUNT_IDS, type AccountId, accountOf } from "./sample-accounts";
import {
	type BankCard,
	CARDS,
	type CardSpendCategory,
	isCardUsable,
} from "./sample-cards";
import { PAYEES, type Payee } from "./sample-payees";
import { createSeededRandom, pickOne, randomInt } from "./seeded-random";

/**
 * Days of history, today included. The 90-day strip compares with the 90 days before, so it needs 180.
 * The oldest statement starts 7 months before the open month. Its opening balance needs up to 246 days.
 */
export const HISTORY_DAYS = 250;

/**
 * Statements per account: the open month and the 7 closed months before it. Two rows of four tiles.
 * The statements page and the "Open statement" link of an entry read it. HISTORY_DAYS must cover it.
 */
export const STATEMENT_MONTHS = 8;

/** How the money moved. "transfer" moves money between two accounts of the customer. */
export const TRANSACTION_METHODS = [
	"ach",
	"wire",
	"card",
	"check",
	"transfer",
	"interest",
	"fee",
] as const;

/** One method. Its label is the message key `methods.<method>`. */
export type TransactionMethod = (typeof TRANSACTION_METHODS)[number];

// Bank days between the booking day and the post day, per method. Cards settle in 2, ACH in 1, checks in 3.
const POST_DELAY_BANK_DAYS = {
	card: 2,
	ach: 1,
	check: 3,
	wire: 0,
	transfer: 0,
	interest: 0,
	fee: 0,
} satisfies Record<TransactionMethod, number>;

/** The day an entry posts, `YYYY-MM-DD`. A wire, a transfer, interest, and a fee post on their booking day. */
export function postDayOf(method: TransactionMethod, day: string): string {
	return addBankDays(day, POST_DELAY_BANK_DAYS[method]);
}

/** The states of an entry. A returned entry stays in the list but does not count in a balance. */
export const TRANSACTION_STATUSES = ["pending", "posted", "returned"] as const;

/** One state. Its label is the message key `statuses.<status>`. */
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

/** What an entry is for. Its label is the message key `categories.<category>`. */
export type TransactionCategory =
	| "clientPayment"
	| CardSpendCategory
	| "suppliers"
	| "contractors"
	| "rent"
	| "utilities"
	| "insurance"
	| "telecom"
	| "waste"
	| "salesTax"
	| "incomeTax"
	| "payroll"
	| "transfer"
	| "interest"
	| "fee";

/** One entry of one account. */
export type Transaction = {
	/** Stable id: the day and the order of the entry in that day. Also the `$transactionId` of the URL. */
	id: string;
	/** The booking day, `YYYY-MM-DD`. An entry has no time of day. */
	day: string;
	accountId: AccountId;
	/** Cents with a sign: positive comes in, negative goes out. */
	amountCents: number;
	/** The other party: a client, a payee, a merchant, or another account of the customer. */
	counterparty: string;
	/** The text of the entry, for example "Invoice 7540". */
	memo: string;
	method: TransactionMethod;
	status: TransactionStatus;
	category: TransactionCategory;
	/** The saved payee of a payment, or null. */
	payeeId: string | null;
	/** The card of a card payment, or null. */
	cardId: string | null;
	/** The other half of a transfer between two accounts, or null. */
	linkedId: string | null;
	/** The trace number of the bank network, 7 digits. */
	reference: string;
};

/** "in" and "out" move money to or from other parties. "transfer" stays inside the business. */
export type TransactionDirection = "in" | "out" | "transfer";

/** The direction of an entry. The money in and money out totals skip transfers. */
export function directionOf(transaction: Transaction): TransactionDirection {
	if (transaction.method === "transfer") {
		return "transfer";
	}
	return transaction.amountCents > 0 ? "in" : "out";
}

/** True when the entry changes the balance. A returned check never reached the account. */
export function countsInBalance(transaction: Transaction): boolean {
	return transaction.status !== "returned";
}

// The clients of the workshop. They pay invoices into the operating account.
const CLIENTS = [
	"Wren & Harlow Architects",
	"Bellmont Hotel Group",
	"Calder Street Dental",
	"Osprey Coffee Roasters",
	"Juniper Lane Homes",
	"Marlowe Library Trust",
	"Fairbairn Restaurants",
	"Kestrel Yacht Interiors",
	"Halden Design Studio",
	"Ottoline Boutique Hotels",
	"Greyfriars School",
	"Bramble & Oak Interiors",
] as const;

// The card spend groups that a staff card buys at a merchant counter. Software has its own schedule.
type CounterCategory = Exclude<CardSpendCategory, "software">;

// The merchants of each spend group.
const MERCHANTS = {
	materials: [
		"Hartley's Builders Yard",
		"Ridgeway Timber Counter",
		"Plank & Panel Depot",
	],
	tools: ["Quarry Lane Hardware", "Toolbox Depot", "Edgewise Blades"],
	fuel: ["Fernway Fuel", "Northroad Service Station"],
	meals: ["Corner Bench Café", "Bluefin Noodle Bar", "Marigold Deli"],
	shipping: ["Crateway Shipping", "Swiftcrate Couriers"],
	office: ["Stationery Loft", "Printwell Copy Shop"],
} as const satisfies Record<CounterCategory, readonly [string, ...string[]]>;

// The smallest and the largest payment of each spend group, in cents.
const CARD_AMOUNT_RANGE = {
	materials: [8_000, 140_000],
	tools: [2_500, 62_000],
	fuel: [4_500, 14_000],
	meals: [1_400, 9_600],
	shipping: [1_800, 26_000],
	office: [900, 18_000],
} as const satisfies Record<CounterCategory, readonly [number, number]>;

// The software plans that the virtual card pays each month, on a fixed day of the month.
const SUBSCRIPTIONS = [
	{ dayOfMonth: 3, merchant: "Sketchform CAD", amountCents: 18_900 },
	{ dayOfMonth: 7, merchant: "Tallybook Accounting", amountCents: 7_200 },
	{ dayOfMonth: 11, merchant: "Cloudnest Storage", amountCents: 3_600 },
	{ dayOfMonth: 22, merchant: "Inkwell Design Suite", amountCents: 6_499 },
] as const;

// The months (1 to 12) with a quarterly estimated tax payment, paid on the 15th.
const ESTIMATED_TAX_MONTHS = [1, 4, 6, 9];

// Monday is 1 and Friday is 5 in DayParts.weekday.
const FRIDAY = 5;

/** The bank itself, as the other party of a fee or of interest. */
const BANK_NAME = "Northbank";

// The contractor who invoices once a month. The other contractors invoice in turns, week by week.
const BOOKKEEPER_ID = "ruth-achterberg";

// One payee by id. The callers pass literal ids of PAYEES; a typo stops the build of the rows with a clear error.
function payeeById(id: string): Payee {
	const payee = PAYEES.find((item) => item.id === id);
	if (!payee) {
		throw new Error(`Unknown sample payee "${id}"`);
	}
	return payee;
}

// One card of a list, with the chance of each card set by its weight. undefined for an empty list.
function pickWeighted(
	random: () => number,
	cards: readonly BankCard[],
): BankCard | undefined {
	const totalWeight = cards.reduce((sum, card) => sum + card.weight, 0);
	let roll = random() * totalWeight;
	for (const card of cards) {
		roll -= card.weight;
		if (roll < 0) {
			return card;
		}
	}
	return cards.at(-1);
}

// The state of an entry on `today`. It stays pending until its post day. A bounce shows only from that day.
function statusOf(
	method: TransactionMethod,
	day: string,
	today: string,
	isReturned: boolean,
): TransactionStatus {
	if (postDayOf(method, day) > today) {
		return "pending";
	}
	return isReturned ? "returned" : "posted";
}

// One entry before the day, the id, and the status are known.
type DraftEntry = Omit<Transaction, "id" | "day" | "status" | "linkedId"> & {
	/** True for a check that bounces. It shows as returned from its post day. */
	isReturned?: boolean;
};

// The initials of a payee name, for an invoice number: "Ines Varga" gives "IV".
function initialsOf(name: string): string {
	return name
		.split(" ")
		.map((word) => word.charAt(0))
		.join("");
}

// The entries of one day. `age` is the count of days between `day` and today: 0 is today.
function buildDay(day: string, age: number): Transaction[] {
	const random = createSeededRandom(dayNumberOf(day));
	const today = addDays(day, age);
	const { year, month, dayOfMonth, weekday } = dayPartsOf(day);
	const isWeekday = weekday >= 1 && weekday <= FRIDAY;
	// A bill due on day N of the month leaves on the first bank day from day N, so never on a weekend.
	const isBillDay = (dueDay: number) =>
		bankDayOnOrAfter(`${day.slice(0, 8)}${String(dueDay).padStart(2, "0")}`) ===
		day;
	// Payroll and interest run on the last bank day on or before their date.
	const isMidMonthRun = bankDayOnOrBefore(`${day.slice(0, 8)}15`) === day;
	const isMonthEndRun = bankDayOnOrBefore(monthEndOf(day)) === day;
	// The business grows: the newest day earns about 20 % more than the oldest day of the history.
	const trend = 0.9 + 0.2 * (1 - age / HISTORY_DAYS);
	const rows: Transaction[] = [];
	const nextId = () =>
		`${day.replaceAll("-", "")}-${String(rows.length + 1).padStart(2, "0")}`;
	const reference = () => String(randomInt(random, 1_000_000, 9_999_999));

	function add({ isReturned = false, ...draft }: DraftEntry): void {
		rows.push({
			...draft,
			id: nextId(),
			day,
			status: statusOf(draft.method, day, today, isReturned),
			linkedId: null,
		});
	}

	function payPayee(
		payeeId: string,
		accountId: AccountId,
		amountCents: number,
		memo: string,
		category: TransactionCategory,
	): void {
		const payee = payeeById(payeeId);
		add({
			accountId,
			amountCents: -amountCents,
			counterparty: payee.name,
			memo,
			method: payee.method,
			category,
			payeeId,
			cardId: null,
			reference: reference(),
		});
	}

	// A transfer is two entries, one per account. Each one points to the other through linkedId.
	function transfer(
		from: AccountId,
		to: AccountId,
		amountCents: number,
		memo: string,
	): void {
		const outId = nextId();
		const inId = `${day.replaceAll("-", "")}-${String(rows.length + 2).padStart(2, "0")}`;
		const shared = {
			day,
			memo,
			method: "transfer",
			status: "posted",
			category: "transfer",
			payeeId: null,
			cardId: null,
			reference: reference(),
		} as const;
		rows.push(
			{
				...shared,
				id: outId,
				accountId: from,
				amountCents: -amountCents,
				counterparty: accountName(to),
				linkedId: inId,
			},
			{
				...shared,
				id: inId,
				accountId: to,
				amountCents,
				counterparty: accountName(from),
				linkedId: outId,
			},
		);
	}

	// Clients pay invoices on working days: none, one, or two payments.
	if (isWeekday) {
		const roll = random();
		const count = roll < 0.55 ? 1 : roll < 0.72 ? 2 : 0;
		for (let index = 0; index < count; index += 1) {
			const methodRoll = random();
			const method =
				methodRoll < 0.68 ? "ach" : methodRoll < 0.9 ? "wire" : "check";
			add({
				accountId: "operating",
				// Whole dollars: an invoice of the workshop has no cents.
				amountCents: Math.round(randomInt(random, 1_600, 9_400) * trend) * 100,
				counterparty: pickOne(random, CLIENTS),
				memo: `Invoice ${(dayNumberOf(day) - 17_000) * 2 + index}`,
				method,
				category: "clientPayment",
				payeeId: null,
				cardId: null,
				reference: reference(),
				// About one check in five bounces. statusOf keeps it pending until its post day.
				isReturned: method === "check" && random() < 0.2,
			});
		}
	}

	// Staff cards pay at merchant counters: one to three payments on a working day, rarely one on a weekend.
	const usableCards = CARDS.filter(
		(card) => card.weight > 0 && isCardUsable(card, age),
	);
	const cardPayments = isWeekday
		? randomInt(random, 1, 3)
		: random() < 0.35
			? 1
			: 0;
	for (let index = 0; index < cardPayments; index += 1) {
		const card = pickWeighted(random, usableCards);
		const categories = card?.spendCategories.filter(
			(category): category is CounterCategory => category !== "software",
		);
		const category = categories?.[Math.floor(random() * categories.length)];
		if (!card || !category) {
			break;
		}
		const [minCents, maxCents] = CARD_AMOUNT_RANGE[category];
		add({
			accountId: "operating",
			amountCents: -randomInt(random, minCents, maxCents),
			counterparty: pickOne(random, MERCHANTS[category]),
			memo: `Card ending ${card.numberEnding}`,
			method: "card",
			category,
			payeeId: null,
			cardId: card.id,
			reference: reference(),
		});
	}

	// The virtual card pays each software plan on its day of the month.
	const softwareCard = CARDS.find((card) => card.kind === "virtual");
	if (softwareCard && isCardUsable(softwareCard, age)) {
		for (const plan of SUBSCRIPTIONS) {
			if (plan.dayOfMonth === dayOfMonth) {
				add({
					accountId: "operating",
					amountCents: -plan.amountCents,
					counterparty: plan.merchant,
					memo: `Card ending ${softwareCard.numberEnding}`,
					method: "card",
					category: "software",
					payeeId: null,
					cardId: softwareCard.id,
					reference: reference(),
				});
			}
		}
	}

	// About one supplier invoice in three working days.
	if (isWeekday && random() < 0.32) {
		const suppliers = PAYEES.filter((payee) => payee.category === "supplier");
		const supplier =
			suppliers[Math.floor(random() * suppliers.length)] ?? suppliers[0];
		if (supplier) {
			payPayee(
				supplier.id,
				"operating",
				randomInt(random, 65_000, 680_000),
				// The invoice number grows with the day, as the numbers of a real supplier do.
				`Invoice ${supplier.id.slice(0, 3).toUpperCase()}-${dayNumberOf(day) - 16_000}`,
				"suppliers",
			);
		}
	}

	// Three site contractors take turns: one of them sends an invoice each week, paid on Friday.
	if (weekday === FRIDAY) {
		const weekNumber = Math.floor(dayNumberOf(day) / 7);
		const contractors = PAYEES.filter(
			(payee) =>
				payee.category === "contractor" &&
				payee.id !== BOOKKEEPER_ID &&
				payee.addedDaysAgo >= age,
		);
		const contractor = contractors[weekNumber % contractors.length];
		if (contractor) {
			payPayee(
				contractor.id,
				"operating",
				randomInt(random, 900, 3_600) * 100,
				`Invoice ${initialsOf(contractor.name)}-${weekNumber - 2_000}`,
				"contractors",
			);
		}
	}

	// The bookkeeper sends one invoice a month, due on the 5th.
	if (isBillDay(5)) {
		const bookkeeper = payeeById(BOOKKEEPER_ID);
		payPayee(
			bookkeeper.id,
			"operating",
			148_000,
			`Invoice ${initialsOf(bookkeeper.name)}-${year * 12 + month - 24_000}`,
			"contractors",
		);
	}

	// Fixed bills, each on its due day of the month.
	if (isBillDay(1)) {
		payPayee("larch-street", "operating", 685_000, "Rent, unit 4", "rent");
		add({
			accountId: "operating",
			amountCents: -2_500,
			counterparty: BANK_NAME,
			memo: "Monthly service fee",
			method: "fee",
			category: "fee",
			payeeId: null,
			cardId: null,
			reference: reference(),
		});
	}
	if (isBillDay(2)) {
		transfer(
			"operating",
			"reserve",
			randomInt(random, 8_000, 9_500) * 100,
			"Monthly tax set-aside",
		);
	}
	if (isBillDay(8)) {
		payPayee(
			"riverside-power",
			"operating",
			randomInt(random, 52_000, 89_000),
			"Electricity and water",
			"utilities",
		);
	}
	if (isBillDay(12)) {
		payPayee(
			"ashbury-mutual",
			"operating",
			121_500,
			"Monthly premium",
			"insurance",
		);
	}
	if (isBillDay(18)) {
		payPayee("clearline", "operating", 18_940, "Phones and fiber", "telecom");
	}
	if (isBillDay(20)) {
		payPayee(
			"fennick-waste",
			"operating",
			14_200,
			"Offcut collection",
			"waste",
		);
		payPayee(
			"department-revenue",
			"reserve",
			randomInt(random, 540_000, 720_000),
			"Sales tax return",
			"salesTax",
		);
	}
	if (isBillDay(15) && ESTIMATED_TAX_MONTHS.includes(month)) {
		payPayee(
			"tax-collector",
			"reserve",
			randomInt(random, 900_000, 1_100_000),
			"Estimated income tax",
			"incomeTax",
		);
	}

	// Payroll runs on the 15th and on the last day of the month, moved back to a Friday from a weekend.
	// The operating account funds it first.
	if (isMidMonthRun || isMonthEndRun) {
		const fundingCents = randomInt(random, 23_000, 26_500) * 100;
		transfer("operating", "payroll", fundingCents, "Payroll funding");
		payPayee(
			"tidewell-payroll",
			"payroll",
			fundingCents - randomInt(random, 0, 400) * 100,
			"Payroll run, 14 employees",
			"payroll",
		);
	}

	// The tax reserve earns interest, paid on the last bank day of the month.
	if (isMonthEndRun) {
		add({
			accountId: "reserve",
			amountCents: randomInt(random, 6_400, 9_200),
			counterparty: BANK_NAME,
			memo: "Interest paid",
			method: "interest",
			category: "interest",
			payeeId: null,
			cardId: null,
			reference: reference(),
		});
	}

	return rows;
}

// The short name of an account, as the other party of a transfer.
function accountName(id: AccountId): string {
	const account = accountOf(id);
	const names = {
		operating: "Operating",
		payroll: "Payroll",
		reserve: "Tax reserve",
	} satisfies Record<AccountId, string>;
	return `${names[id]} ••${account.numberEnding}`;
}

// The last build, kept for the day it was built. Every query of the same day reuses it.
let cache: { today: string; rows: Transaction[] } | null = null;

/** Every entry of the history, newest first. `today` is `YYYY-MM-DD`; the rows change only when it changes. */
export function listTransactions(today: string): Transaction[] {
	if (cache?.today !== today) {
		const rows: Transaction[] = [];
		for (let age = HISTORY_DAYS - 1; age >= 0; age -= 1) {
			rows.push(...buildDay(addDays(today, -age), age));
		}
		// Newest day first. Inside a day, the last entry first.
		rows.sort((first, second) => second.id.localeCompare(first.id));
		cache = { today, rows };
	}
	return cache.rows;
}

/** The end-of-day balance of every account on one day, in cents. */
export type DailyBalance = {
	day: string;
	byAccount: Record<AccountId, number>;
	/** The sum of the three accounts. */
	totalCents: number;
};

/** One balance per day of the history, oldest first. Each account starts at its opening balance. */
export function listDailyBalances(today: string): DailyBalance[] {
	const firstDay = addDays(today, -(HISTORY_DAYS - 1));
	const changes = Array.from({ length: HISTORY_DAYS }, () => ({
		operating: 0,
		payroll: 0,
		reserve: 0,
	}));
	for (const row of listTransactions(today)) {
		const change = changes[daysBetween(firstDay, row.day)];
		if (change && countsInBalance(row)) {
			change[row.accountId] += row.amountCents;
		}
	}
	const running = {
		operating: accountOf("operating").openingBalanceCents,
		payroll: accountOf("payroll").openingBalanceCents,
		reserve: accountOf("reserve").openingBalanceCents,
	} satisfies Record<AccountId, number>;
	return changes.map((change, index) => {
		for (const id of ACCOUNT_IDS) {
			running[id] += change[id];
		}
		return {
			day: addDays(firstDay, index),
			byAccount: { ...running },
			totalCents: ACCOUNT_IDS.reduce((sum, id) => sum + running[id], 0),
		};
	});
}
