// The transactions of the sample studio for the last 186 days, the scheduled entries of the next days,
// and the daily balance of each account.
// The queries of the overview, transactions, accounts, and budgets features call the two list functions.
// Each calendar day gives the same rows on every load: fixed monthly bills, pay days, and seeded daily entries.
// To make it real: this file becomes the table `transactions`, and each queryFn reads Supabase.
import type { CategoryId } from "./categories";
import {
	addDays,
	addMonths,
	dayNumberOf,
	dayPartsOf,
	daysBetween,
	lastDays,
	monthEndOf,
	monthStartOf,
	toIsoDay,
} from "./ledger-day";
import { type AccountId, accountNameOf } from "./sample-accounts";
import { createSeededRandom, pickOne, randomInt } from "./seeded-random";

/**
 * The length of the history, in days. The home bar chart shows six calendar months: this month and the 5 before.
 * The first day of the month 5 months back is at most 185 days ago. A 90-day period also needs its 90 days before.
 */
export const HISTORY_DAYS = 186;

/** The kinds of entry. A transfer moves money between two accounts, so it is not income and not an expense. */
export const TRANSACTION_TYPES = ["income", "expense", "transfer"] as const;

/** One kind of entry. Its label is the message key `transactionTypes.<type>`. */
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

/** The states of an entry, in the order of the work: recorded, seen by the bank, checked against the statement. */
export const TRANSACTION_STATUSES = [
	"pending",
	"cleared",
	"reconciled",
] as const;

/** One state. Its label is the message key `transactionStatuses.<status>`. */
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

/** How the money moved. The label is the message key `paymentMethods.<method>`. */
export type PaymentMethod =
	| "bank_transfer"
	| "card"
	| "direct_debit"
	| "cash"
	| "online";

/** One row of `transactions`. */
export type Transaction = {
	/** The entry number, for example "261113-02": the day as YYMMDD and the rank in that day. Also the URL id. */
	id: string;
	/** The day of the entry, as `YYYY-MM-DD`. An entry has no time of day. */
	day: string;
	type: TransactionType;
	/** Who paid or who got the money. For a transfer: the name of the other account. */
	payee: string;
	/** A short note of the bookkeeper. */
	memo: string;
	categoryId: CategoryId;
	accountId: AccountId;
	/** The amount in cents, with its sign for the account: positive comes in, negative goes out. */
	amountCents: number;
	method: PaymentMethod;
	status: TransactionStatus;
	/** The day the bank confirmed the entry. null while it is pending. */
	clearedDay: string | null;
	/** The day the team checked the entry against the statement. null before that check. */
	reconciledDay: string | null;
	/** The id of the other half of a transfer. null for income and expenses. */
	linkedId: string | null;
};

/** The balance of one account at the end of one day. */
export type DailyBalance = {
	/** `YYYY-MM-DD`. */
	day: string;
	/** In cents. Negative on the card: the studio owes this amount. */
	balanceCents: number;
};

// One entry before it gets its day, its id, and its status.
type Entry = Pick<
	Transaction,
	| "type"
	| "payee"
	| "memo"
	| "categoryId"
	| "accountId"
	| "amountCents"
	| "method"
>;

// A bill or a receipt that comes on the same day of each month.
type MonthlyEntry = Entry & {
	/** 1 to 28, so the day exists in every month. */
	dayOfMonth: number;
	/** The amount changes by up to this many cents from month to month. 0 for a fixed amount. */
	spreadCents: number;
};

const MONTHLY_ENTRIES: readonly MonthlyEntry[] = [
	{
		dayOfMonth: 1,
		type: "expense",
		payee: "Wharf Street Properties",
		memo: "Studio rent, unit 4B",
		categoryId: "rent",
		accountId: "operating",
		amountCents: -380_000,
		spreadCents: 0,
		method: "direct_debit",
	},
	{
		dayOfMonth: 2,
		type: "expense",
		payee: "Inkwell Design Suite",
		memo: "Design software, 6 seats",
		categoryId: "software",
		accountId: "card",
		amountCents: -32_994,
		spreadCents: 0,
		method: "card",
	},
	{
		// A fixed early spend: it puts marketing ahead of pace in the first half of most months.
		dayOfMonth: 2,
		type: "expense",
		payee: "Signal Weekly",
		memo: "Newsletter sponsorship",
		categoryId: "marketing",
		accountId: "card",
		amountCents: -64_000,
		spreadCents: 8_000,
		method: "card",
	},
	{
		dayOfMonth: 3,
		type: "income",
		payee: "Halden & Roe Architects",
		memo: "Monthly retainer, brand support",
		categoryId: "retainers",
		accountId: "operating",
		amountCents: 480_000,
		spreadCents: 0,
		method: "bank_transfer",
	},
	{
		dayOfMonth: 4,
		type: "expense",
		payee: "Shieldmark Insurance",
		memo: "Liability and contents cover",
		categoryId: "insurance",
		accountId: "operating",
		amountCents: -41_850,
		spreadCents: 0,
		method: "direct_debit",
	},
	{
		dayOfMonth: 5,
		type: "expense",
		payee: "Northquay Bank",
		memo: "Account service fee",
		categoryId: "insurance",
		accountId: "operating",
		amountCents: -3_500,
		spreadCents: 0,
		method: "direct_debit",
	},
	{
		dayOfMonth: 7,
		type: "expense",
		payee: "Stackboard",
		memo: "Project boards, team plan",
		categoryId: "software",
		accountId: "card",
		amountCents: -9_600,
		spreadCents: 0,
		method: "card",
	},
	{
		dayOfMonth: 8,
		type: "income",
		payee: "Brightwater Clinic",
		memo: "Monthly retainer, patient leaflets",
		categoryId: "retainers",
		accountId: "operating",
		amountCents: 320_000,
		spreadCents: 0,
		method: "bank_transfer",
	},
	{
		dayOfMonth: 9,
		type: "expense",
		payee: "Tidewater Power",
		memo: "Electricity, studio",
		categoryId: "rent",
		accountId: "operating",
		amountCents: -18_400,
		spreadCents: 7_600,
		method: "direct_debit",
	},
	{
		dayOfMonth: 11,
		type: "expense",
		payee: "Cloudharbor Storage",
		memo: "File storage, 2 TB",
		categoryId: "software",
		accountId: "card",
		amountCents: -4_800,
		spreadCents: 0,
		method: "card",
	},
	{
		dayOfMonth: 12,
		type: "expense",
		payee: "Kestrel Fiber",
		memo: "Internet, business line",
		categoryId: "rent",
		accountId: "operating",
		amountCents: -8_900,
		spreadCents: 0,
		method: "direct_debit",
	},
	{
		dayOfMonth: 14,
		type: "expense",
		payee: "Hourglass Time Tracking",
		memo: "Timesheets, 6 seats",
		categoryId: "software",
		accountId: "card",
		amountCents: -7_200,
		spreadCents: 0,
		method: "card",
	},
	{
		dayOfMonth: 17,
		type: "income",
		payee: "Ospren Cycles",
		memo: "Monthly retainer, campaign design",
		categoryId: "retainers",
		accountId: "operating",
		amountCents: 550_000,
		spreadCents: 0,
		method: "bank_transfer",
	},
	{
		dayOfMonth: 18,
		type: "expense",
		payee: "Mailpetal",
		memo: "Newsletter tool",
		categoryId: "software",
		accountId: "card",
		amountCents: -5_900,
		spreadCents: 0,
		method: "card",
	},
	{
		dayOfMonth: 21,
		type: "expense",
		payee: "Fontory",
		memo: "Font licenses, studio plan",
		categoryId: "software",
		accountId: "card",
		amountCents: -11_900,
		spreadCents: 0,
		method: "card",
	},
	{
		dayOfMonth: 24,
		type: "income",
		payee: "Fennel Kitchen Co.",
		memo: "Monthly retainer, menus and social",
		categoryId: "retainers",
		accountId: "operating",
		amountCents: 275_000,
		spreadCents: 0,
		method: "bank_transfer",
	},
	{
		dayOfMonth: 26,
		type: "expense",
		payee: "Pixelforge Stock",
		memo: "Stock images, 50 downloads",
		categoryId: "software",
		accountId: "card",
		amountCents: -19_900,
		spreadCents: 0,
		method: "card",
	},
	{
		dayOfMonth: 28,
		type: "income",
		payee: "Northquay Bank",
		memo: "Savings interest",
		categoryId: "other_income",
		accountId: "tax-reserve",
		amountCents: 1_180,
		spreadCents: 240,
		method: "bank_transfer",
	},
];

// Net pay of the five people of the studio for half a month, in cents.
const PAYROLL_RUN_CENTS = 1_046_025;
// The months of the estimated tax payments, each on day 15, in the order of the tax year.
// April pays quarter 1, June quarter 2, September quarter 3, and January quarter 4. The index + 1 is the quarter.
const TAX_MONTHS = [4, 6, 9, 1];
const TAX_PAYMENT_CENTS = 690_000;
// The day of the month of each transfer between accounts.
const CASH_TOP_UP_DAY = 3;
const TAX_SET_ASIDE_DAY = 16;
const CARD_PAYMENT_DAY = 22;
const TAX_SET_ASIDE_CENTS = 240_000;
// A client project payment comes every 5 days, so each 30-day window holds about 6 of them.
const INVOICE_EVERY_DAYS = 5;
// A workshop seat costs 95.00.
const WORKSHOP_SEAT_CENTS = 9_500;
// The team pays a purchase under 50.00 from the cash box.
const CASH_LIMIT_CENTS = 5_000;

const PROJECT_CLIENTS = [
	"Marlow Outdoor",
	"Tessellate Labs",
	"Quillfeather Books",
	"Northgate Dental",
	"Copperline Brewing",
	"Lumen Yoga Studio",
	"Pinecrest School",
	"Saltmarsh Hotel",
	"Vireo Health",
	"Atlas & Finch",
] as const;

const PROJECT_NAMES = [
	"brand guidelines",
	"website redesign, phase 2",
	"packaging concepts",
	"annual report layout",
	"signage system",
	"campaign visuals",
	"photo direction",
	"menu redesign",
	"illustration set",
	"pitch deck design",
] as const;

const WORKSHOP_TITLES = [
	"Brand basics",
	"Type for non-designers",
	"Print-ready files",
] as const;

// A freelancer that the studio hires by the day.
type Contractor = {
	payee: string;
	role: string;
	/** The fee of one day of work, in cents. */
	dayRateCents: number;
};

const CONTRACTORS = [
	{ payee: "Imani Okoro", role: "Illustration", dayRateCents: 48_000 },
	{ payee: "Tomás Belmonte", role: "Motion design", dayRateCents: 52_000 },
	{ payee: "Greta Lindqvist", role: "Copywriting", dayRateCents: 42_000 },
	{ payee: "Yusuf Demirci", role: "Front-end build", dayRateCents: 56_000 },
	{ payee: "Hana Moriyama", role: "Photography", dayRateCents: 46_000 },
] as const satisfies readonly Contractor[];

// A vendor with the range of one purchase, in cents.
type Vendor = {
	payee: string;
	memo: string;
	minCents: number;
	maxCents: number;
};

const MARKETING_VENDORS = [
	{
		payee: "Beacon Ads",
		memo: "Search campaign, weekly spend",
		minCents: 9_000,
		maxCents: 32_000,
	},
	{
		payee: "Printworks Co-op",
		memo: "Postcards, 500 copies",
		minCents: 14_000,
		maxCents: 38_000,
	},
	{
		payee: "Quietfield Podcast",
		memo: "Podcast ad read",
		minCents: 18_000,
		maxCents: 36_000,
	},
	{
		payee: "Gather Events",
		memo: "Trade fair stand, deposit",
		minCents: 30_000,
		maxCents: 62_000,
	},
] as const satisfies readonly Vendor[];

const MEAL_VENDORS = [
	{
		payee: "Juniper Café",
		memo: "Client lunch",
		minCents: 3_200,
		maxCents: 8_400,
	},
	{
		payee: "Noodle Bar Kumo",
		memo: "Team lunch",
		minCents: 4_800,
		maxCents: 9_600,
	},
	{
		payee: "Brasserie Lune",
		memo: "Client dinner",
		minCents: 7_200,
		maxCents: 16_800,
	},
	{
		payee: "Roastery Nine",
		memo: "Coffee for the studio",
		minCents: 1_800,
		maxCents: 4_200,
	},
] as const satisfies readonly Vendor[];

const TRAVEL_VENDORS = [
	{
		payee: "Coastline Rail",
		memo: "Return tickets, client visit",
		minCents: 6_400,
		maxCents: 18_600,
	},
	{
		payee: "Gullpath Air",
		memo: "Flight, design conference",
		minCents: 21_000,
		maxCents: 54_000,
	},
	{
		payee: "The Ferryman Inn",
		memo: "Hotel, 2 nights",
		minCents: 24_000,
		maxCents: 39_000,
	},
	{
		payee: "Metro Cabs",
		memo: "Airport transfer",
		minCents: 3_500,
		maxCents: 7_800,
	},
] as const satisfies readonly Vendor[];

const SUPPLY_VENDORS = [
	{
		payee: "Paper & Pine Stationers",
		memo: "Sketchbooks and markers",
		minCents: 2_400,
		maxCents: 11_800,
	},
	{
		payee: "Corner Hardware",
		memo: "Mounting tape and blades",
		minCents: 1_400,
		maxCents: 5_200,
	},
	{
		payee: "Greenleaf Market",
		memo: "Kitchen supplies",
		minCents: 1_800,
		maxCents: 6_400,
	},
	{
		payee: "Paper & Pine Stationers",
		memo: "Printer paper, A3",
		minCents: 4_200,
		maxCents: 16_000,
	},
	{
		payee: "Harbour Lane Post Office",
		memo: "Stamps and parcel post",
		minCents: 900,
		maxCents: 3_400,
	},
] as const satisfies readonly Vendor[];

const EQUIPMENT_VENDORS = [
	{
		payee: "Voltline Electronics",
		memo: "27-inch monitor",
		minCents: 42_000,
		maxCents: 68_000,
	},
	{
		payee: "Bentfold Furniture",
		memo: "Desk chair",
		minCents: 31_000,
		maxCents: 52_000,
	},
	{
		payee: "Voltline Electronics",
		memo: "Drawing tablet",
		minCents: 24_000,
		maxCents: 39_000,
	},
	{
		payee: "Lensmith Camera",
		memo: "Lens rental, 1 week",
		minCents: 12_000,
		maxCents: 26_000,
	},
] as const satisfies readonly Vendor[];

// One purchase from one vendor of a list. A small purchase comes from the cash box when `allowCash` is true.
function purchaseOf(
	random: () => number,
	vendors: readonly [Vendor, ...Vendor[]],
	categoryId: CategoryId,
	allowCash: boolean,
): Entry {
	const vendor = pickOne(random, vendors);
	const priceCents = randomInt(random, vendor.minCents, vendor.maxCents);
	const paysCash = allowCash && priceCents < CASH_LIMIT_CENTS;
	return {
		type: "expense",
		payee: vendor.payee,
		memo: vendor.memo,
		categoryId,
		accountId: paysCash ? "petty-cash" : "card",
		amountCents: -priceCents,
		method: paysCash ? "cash" : "card",
	};
}

// The bills and receipts of the day of the month of `day`.
function monthlyEntriesOf(day: string): Entry[] {
	const { year, month, dayOfMonth } = dayPartsOf(day);
	// One generator per month, so the amount of a bill changes from month to month and not from load to load.
	const random = createSeededRandom(year * 12 + month);
	return MONTHLY_ENTRIES.map(
		({ dayOfMonth: billDay, spreadCents, ...entry }) => {
			const shiftCents =
				spreadCents === 0 ? 0 : randomInt(random, 0, spreadCents);
			return {
				billDay,
				entry: {
					...entry,
					// The shift goes away from zero, so a bill grows and a receipt grows.
					amountCents:
						entry.amountCents + Math.sign(entry.amountCents) * shiftCents,
				},
			};
		},
	)
		.filter(({ billDay }) => billDay === dayOfMonth)
		.map(({ entry }) => entry);
}

// Pay day is day 15 and the last day of the month. On a weekend, the bank pays on the Friday before.
function isPayDay(day: string): boolean {
	const { weekday } = dayPartsOf(day);
	if (weekday === 0 || weekday === 6) {
		return false;
	}
	return [`${day.slice(0, 7)}-15`, monthEndOf(day)].some((payDay) => {
		const daysToPayDay = daysBetween(day, payDay);
		return (
			daysToPayDay === 0 ||
			(weekday === 5 && (daysToPayDay === 1 || daysToPayDay === 2))
		);
	});
}

// The payroll run and the estimated tax payment, on their days only.
function scheduledEntriesOf(day: string): Entry[] {
	const { month, dayOfMonth } = dayPartsOf(day);
	const entries: Entry[] = [];
	if (isPayDay(day)) {
		entries.push({
			type: "expense",
			payee: "Staff payroll",
			memo: "Salaries, 5 people",
			categoryId: "payroll",
			accountId: "operating",
			amountCents: -PAYROLL_RUN_CENTS,
			method: "bank_transfer",
		});
	}
	if (dayOfMonth === 15 && TAX_MONTHS.includes(month)) {
		entries.push({
			type: "expense",
			payee: "Harbor State Tax Office",
			memo: `Estimated tax, quarter ${TAX_MONTHS.indexOf(month) + 1}`,
			categoryId: "taxes",
			accountId: "tax-reserve",
			amountCents: -TAX_PAYMENT_CENTS,
			method: "bank_transfer",
		});
	}
	return entries;
}

// The entries that change from day to day: client payments, contractors, and purchases.
// A client payment comes on a fixed rhythm. Each chance below is the share of days with such an entry.
function dailyEntriesOf(day: string): Entry[] {
	const { weekday } = dayPartsOf(day);
	const dayNumber = dayNumberOf(day);
	// 7919 is a prime. It spreads the seeds of days that follow each other.
	const random = createSeededRandom(dayNumber * 7919 + 17);
	const entries: Entry[] = [];
	if (weekday === 6) {
		// A workshop runs on about 2 Saturdays per month.
		if (random() < 0.45) {
			const seats = randomInt(random, 8, 16);
			entries.push({
				type: "income",
				payee: "Workshop bookings",
				memo: `${pickOne(random, WORKSHOP_TITLES)}, ${seats} seats`,
				categoryId: "workshops",
				accountId: "operating",
				amountCents: seats * WORKSHOP_SEAT_CENTS,
				method: "online",
			});
		}
		return entries;
	}
	if (weekday === 0) {
		return entries;
	}
	// The bank pays on weekdays only, so a payment due on Saturday or Sunday arrives on Monday.
	const slotsOfToday = weekday === 1 ? [0, 1, 2] : [0];
	const hasInvoice = slotsOfToday.some(
		(daysBack) => (dayNumber - daysBack) % INVOICE_EVERY_DAYS === 0,
	);
	if (hasInvoice) {
		// A project invoice is 3,000.00 to 5,500.00, in steps of 50.00.
		const invoiceCents = randomInt(random, 60, 110) * 5_000;
		// The invoice number grows by one per day, so a later invoice has a higher number.
		const invoiceNumber = dayNumber - 19_000;
		entries.push({
			type: "income",
			payee: pickOne(random, PROJECT_CLIENTS),
			memo: `Invoice ${invoiceNumber}, ${pickOne(random, PROJECT_NAMES)}`,
			categoryId: "client_projects",
			accountId: "operating",
			amountCents: invoiceCents,
			method: "bank_transfer",
		});
	}
	if (random() < 0.18) {
		const contractor = pickOne<Contractor>(random, CONTRACTORS);
		const days = randomInt(random, 1, 4);
		entries.push({
			type: "expense",
			payee: contractor.payee,
			memo: `${contractor.role}, ${days} ${days === 1 ? "day" : "days"}`,
			categoryId: "contractors",
			accountId: "operating",
			amountCents: -days * contractor.dayRateCents,
			method: "bank_transfer",
		});
	}
	if (random() < 0.12) {
		entries.push(purchaseOf(random, MARKETING_VENDORS, "marketing", false));
	}
	if (random() < 0.3) {
		entries.push(purchaseOf(random, MEAL_VENDORS, "travel", true));
	}
	if (random() < 0.07) {
		entries.push(purchaseOf(random, TRAVEL_VENDORS, "travel", false));
	}
	if (random() < 0.15) {
		entries.push(purchaseOf(random, SUPPLY_VENDORS, "supplies", true));
	}
	if (random() < 0.035) {
		entries.push(purchaseOf(random, EQUIPMENT_VENDORS, "equipment", false));
	}
	return entries;
}

// A cache: the entries of a day never change, and the card payment reads the days of a full month again.
const entriesByDay = new Map<string, Entry[]>();

// Every income and expense entry of one calendar day, in a fixed order. It holds no transfer.
function entriesOf(day: string): Entry[] {
	const cached = entriesByDay.get(day);
	if (cached) {
		return cached;
	}
	const entries = [
		...monthlyEntriesOf(day),
		...scheduledEntriesOf(day),
		...dailyEntriesOf(day),
	];
	entriesByDay.set(day, entries);
	return entries;
}

// What `accountId` paid from `fromDay` to `toDay`, both included, as a positive count of cents.
function spendCentsBetween(
	accountId: AccountId,
	fromDay: string,
	toDay: string,
): number {
	let spendCents = 0;
	for (let day = fromDay; day <= toDay; day = addDays(day, 1)) {
		for (const entry of entriesOf(day)) {
			if (entry.accountId === accountId) {
				spendCents -= entry.amountCents;
			}
		}
	}
	return spendCents;
}

// The two halves of one move from the operating account to another account.
function transferOf(
	toAccountId: AccountId,
	amountCents: number,
	memo: string,
	method: PaymentMethod,
): Entry[] {
	const half = {
		type: "transfer",
		categoryId: "transfer",
		memo,
		method,
	} as const;
	return [
		{
			...half,
			payee: accountNameOf(toAccountId),
			accountId: "operating",
			amountCents: -amountCents,
		},
		{
			...half,
			payee: accountNameOf("operating"),
			accountId: toAccountId,
			amountCents,
		},
	];
}

// The transfers of one day: the cash top-up, the tax set-aside, and the payment of the card.
// Each transfer gives two entries: the half that leaves, then the half that arrives.
function transferEntriesOf(day: string): Entry[] {
	const { dayOfMonth } = dayPartsOf(day);
	// The month before: the cash box and the card both settle the spend of that month.
	const lastMonthStart = addMonths(day, -1);
	const lastMonthEnd = monthEndOf(lastMonthStart);
	if (dayOfMonth === CASH_TOP_UP_DAY) {
		// The top-up gives back what the cash box spent last month, so the box returns to the same float.
		const cashSpentCents = spendCentsBetween(
			"petty-cash",
			lastMonthStart,
			lastMonthEnd,
		);
		return cashSpentCents === 0
			? []
			: transferOf("petty-cash", cashSpentCents, "Cash box top-up", "cash");
	}
	if (dayOfMonth === TAX_SET_ASIDE_DAY) {
		return transferOf(
			"tax-reserve",
			TAX_SET_ASIDE_CENTS,
			"Monthly tax set-aside",
			"bank_transfer",
		);
	}
	if (dayOfMonth === CARD_PAYMENT_DAY) {
		// The payment covers every card purchase of the month before.
		const statementCents = spendCentsBetween(
			"card",
			lastMonthStart,
			lastMonthEnd,
		);
		return statementCents === 0
			? []
			: transferOf(
					"card",
					statementCents,
					"Card payment, last statement",
					"bank_transfer",
				);
	}
	return [];
}

// "261113-02": the day as YYMMDD, then the rank of the entry in that day, from 1.
function idOf(day: string, index: number): string {
	return `${day.slice(2, 4)}${day.slice(5, 7)}${day.slice(8, 10)}-${String(index + 1).padStart(2, "0")}`;
}

// The rows of one day. `today` decides the status: a new entry is pending, an old one is reconciled.
function rowsOf(day: string, today: string): Transaction[] {
	const entries = entriesOf(day);
	const transferEntries = transferEntriesOf(day);
	return [...entries, ...transferEntries].map((entry, index) => {
		const transferIndex = index - entries.length;
		// Cash clears at once. A transfer clears the next day. A bank or card entry takes 1 or 2 days.
		const daysToClear =
			entry.method === "cash" ? 0 : transferIndex >= 0 ? 1 : 1 + (index % 2);
		const clearedDay = addDays(day, daysToClear);
		// The team checks each month against its statement on day 5 of the next month.
		const reconciledDay = `${addMonths(day, 1).slice(0, 7)}-05`;
		// `YYYY-MM-DD` texts compare in date order.
		const isCleared = clearedDay <= today;
		const isReconciled = reconciledDay <= today;
		// The two halves of a transfer follow each other: the even one leaves, the odd one arrives.
		const linkedIndex =
			transferIndex < 0 ? null : index + (transferIndex % 2 === 0 ? 1 : -1);
		return {
			...entry,
			id: idOf(day, index),
			day,
			status: isReconciled ? "reconciled" : isCleared ? "cleared" : "pending",
			clearedDay: isCleared ? clearedDay : null,
			reconciledDay: isReconciled ? reconciledDay : null,
			linkedId: linkedIndex === null ? null : idOf(day, linkedIndex),
		};
	});
}

// A cache of the last answer: several queries ask for the same day, and the rows of a day never change.
let ledgerOfToday: { today: string; rows: Transaction[] } | null = null;

/**
 * Every entry of the history (HISTORY_DAYS), newest first. `nowMs` is the current time in milliseconds since 1970.
 * The rows depend only on the calendar day of `nowMs`, so they stay the same from midnight to midnight.
 */
export function listTransactions(nowMs: number): Transaction[] {
	const today = toIsoDay(nowMs);
	if (ledgerOfToday?.today !== today) {
		ledgerOfToday = {
			today,
			rows: lastDays(today, HISTORY_DAYS)
				.flatMap((day) => rowsOf(day, today))
				.reverse(),
		};
	}
	return ledgerOfToday.rows;
}

// The balance of each bank and cash account at the end of today, in cents.
// The series walks back from it, so an old entry that leaves the history never moves the balance of today.
const CLOSING_BALANCE_CENTS = {
	operating: 8_641_257,
	"tax-reserve": 941_280,
	"petty-cash": 34_215,
} satisfies Record<Exclude<AccountId, "card">, number>;

// The balance of one account before the first entry of `firstDay`.
// `historyMovedCents` is the sum of every entry of the account in the history, in cents.
function openingBalanceCentsOf(
	accountId: AccountId,
	firstDay: string,
	historyMovedCents: number,
): number {
	if (accountId !== "card") {
		return CLOSING_BALANCE_CENTS[accountId] - historyMovedCents;
	}
	// The card owes every purchase that no payment covers yet.
	// Up to the payment day, that is the month before and this month. After it, only this month.
	const { dayOfMonth } = dayPartsOf(firstDay);
	const unpaidStart =
		dayOfMonth <= CARD_PAYMENT_DAY
			? addMonths(firstDay, -1)
			: monthStartOf(firstDay);
	return -spendCentsBetween("card", unpaidStart, addDays(firstDay, -1));
}

/**
 * The balance of every account at the end of each day, oldest first: HISTORY_DAYS + 1 points.
 * The first point is the day before the history, so it holds the opening balance. The days of the history follow.
 * The last point of a bank or cash account is its fixed balance of today. The card owes its unpaid purchases.
 */
export function listDailyBalances(
	nowMs: number,
): Record<AccountId, DailyBalance[]> {
	const days = lastDays(toIsoDay(nowMs), HISTORY_DAYS);
	const rows = listTransactions(nowMs);
	const firstDay = days[0] ?? toIsoDay(nowMs);
	const balancesOf = (accountId: AccountId): DailyBalance[] => {
		const movedCentsByDay = new Map<string, number>();
		let historyMovedCents = 0;
		for (const row of rows) {
			if (row.accountId === accountId) {
				movedCentsByDay.set(
					row.day,
					(movedCentsByDay.get(row.day) ?? 0) + row.amountCents,
				);
				historyMovedCents += row.amountCents;
			}
		}
		let balanceCents = openingBalanceCentsOf(
			accountId,
			firstDay,
			historyMovedCents,
		);
		const opening = { day: addDays(firstDay, -1), balanceCents };
		return [
			opening,
			...days.map((day) => {
				balanceCents += movedCentsByDay.get(day) ?? 0;
				return { day, balanceCents };
			}),
		];
	};
	return {
		operating: balancesOf("operating"),
		"tax-reserve": balancesOf("tax-reserve"),
		card: balancesOf("card"),
		"petty-cash": balancesOf("petty-cash"),
	};
}

/** One entry that the calendar fixes in advance: a bill, a receipt, the payroll, or a tax payment. It has no id yet. */
export type ScheduledEntry = Entry & {
	/** The day the entry is due, as `YYYY-MM-DD`. Always after today. */
	day: string;
};

/**
 * The fixed entries of the next `days` days, the soonest first. The random daily entries are not in it:
 * nobody knows them in advance. The transactions page shows the list in its "Upcoming" tab.
 */
export function listScheduledEntries(
	nowMs: number,
	days: number,
): ScheduledEntry[] {
	const today = toIsoDay(nowMs);
	return Array.from({ length: days }, (_, index) =>
		addDays(today, index + 1),
	).flatMap((day) =>
		[...monthlyEntriesOf(day), ...scheduledEntriesOf(day)].map((entry) => ({
			...entry,
			day,
		})),
	);
}
