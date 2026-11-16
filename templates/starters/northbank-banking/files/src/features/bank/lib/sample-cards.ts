// The debit cards of the business: six physical cards for staff and one virtual card for software.
// It stands in for a `cards` table. sample-transactions.ts books card payments on the cards that are usable that day.
// Every holder name and number here is fictional.
import { addDays } from "./bank-day";

/** The spend groups of a card payment. The cards page breaks the spend down by them. */
export const CARD_SPEND_CATEGORIES = [
	"materials",
	"tools",
	"fuel",
	"meals",
	"shipping",
	"office",
	"software",
] as const;

/** One spend group. Its label is the message key `categories.<category>`. */
export type CardSpendCategory = (typeof CARD_SPEND_CATEGORIES)[number];

/** The states of a card, in the order of the tabs of the cards page. */
export const CARD_STATUSES = ["active", "frozen", "cancelled"] as const;

/** One card state. "frozen" stops payments for a time; "cancelled" stops them for good. */
export type CardStatus = (typeof CARD_STATUSES)[number];

/** One card of the business. Every card pays from the operating account. */
export type BankCard = {
	/** Stable id, also the `$cardId` of the detail page URL. */
	id: string;
	/** The name on the card. A virtual card carries the name of its manager. */
	holderName: string;
	/** The job of the holder, or the use of a virtual card. Message key `cards.roles.<role>`. */
	role:
		| "owner"
		| "workshopLead"
		| "officeManager"
		| "installer"
		| "designer"
		| "software";
	kind: "physical" | "virtual";
	/** The last 4 digits of the card number. */
	numberEnding: string;
	/** The spend limit of one calendar month, in cents. It resets on the 1st. */
	monthlyLimitCents: number;
	/** Days between the issue of the card and today. The card has no payment before that day. */
	issuedDaysAgo: number;
	/** Days since the freeze, or null. The card has no payment from that day. */
	frozenDaysAgo: number | null;
	/** Days since the cancel, or null. The card has no payment from that day. */
	cancelledDaysAgo: number | null;
	/** The spend groups of the holder. The generator picks a merchant of one of them. Empty for the virtual card. */
	spendCategories: readonly CardSpendCategory[];
	/** The share of the daily card payments that this card makes, against the other cards. */
	weight: number;
};

/** The cards, the newest holder last. */
export const CARDS: readonly BankCard[] = [
	{
		id: "card-4417",
		holderName: "Maya Okafor",
		role: "owner",
		kind: "physical",
		numberEnding: "4417",
		monthlyLimitCents: 1_500_000,
		issuedDaysAgo: 820,
		frozenDaysAgo: null,
		cancelledDaysAgo: null,
		spendCategories: ["materials", "meals", "office", "tools"],
		weight: 2,
	},
	{
		id: "card-2093",
		holderName: "Daniel Brennan",
		role: "workshopLead",
		kind: "physical",
		numberEnding: "2093",
		monthlyLimitCents: 600_000,
		issuedDaysAgo: 700,
		frozenDaysAgo: null,
		cancelledDaysAgo: null,
		spendCategories: ["materials", "tools", "shipping"],
		weight: 3,
	},
	{
		id: "card-6650",
		holderName: "Priya Natarajan",
		role: "officeManager",
		kind: "physical",
		numberEnding: "6650",
		monthlyLimitCents: 400_000,
		issuedDaysAgo: 610,
		frozenDaysAgo: null,
		cancelledDaysAgo: null,
		spendCategories: ["office", "shipping", "meals"],
		weight: 2,
	},
	{
		id: "card-9035",
		holderName: "Priya Natarajan",
		role: "software",
		kind: "virtual",
		numberEnding: "9035",
		monthlyLimitCents: 150_000,
		issuedDaysAgo: 540,
		frozenDaysAgo: null,
		cancelledDaysAgo: null,
		spendCategories: [],
		weight: 0,
	},
	{
		id: "card-7702",
		holderName: "Hana Kobayashi",
		role: "designer",
		kind: "physical",
		numberEnding: "7702",
		monthlyLimitCents: 200_000,
		issuedDaysAgo: 330,
		frozenDaysAgo: 9,
		cancelledDaysAgo: null,
		spendCategories: ["materials", "meals", "office"],
		weight: 1,
	},
	{
		id: "card-1268",
		holderName: "Samuel Otieno",
		role: "installer",
		kind: "physical",
		numberEnding: "1268",
		monthlyLimitCents: 250_000,
		issuedDaysAgo: 480,
		frozenDaysAgo: null,
		cancelledDaysAgo: 41,
		spendCategories: ["fuel", "tools", "meals"],
		weight: 2,
	},
	{
		id: "card-3184",
		holderName: "Luis Ferreira",
		role: "installer",
		kind: "physical",
		numberEnding: "3184",
		monthlyLimitCents: 250_000,
		issuedDaysAgo: 40,
		frozenDaysAgo: null,
		cancelledDaysAgo: null,
		spendCategories: ["fuel", "tools", "meals"],
		weight: 2,
	},
];

/** One card by id, or undefined for an id from a changed URL. */
export function findCard(id: string): BankCard | undefined {
	return CARDS.find((card) => card.id === id);
}

/** The state of a card today. A cancel wins over a freeze. */
export function cardStatusOf(card: BankCard): CardStatus {
	if (card.cancelledDaysAgo !== null) {
		return "cancelled";
	}
	return card.frozenDaysAgo === null ? "active" : "frozen";
}

/** The day when the card took its current state: the cancel day, the freeze day, or the issue day. */
export function cardStatusSince(card: BankCard, today: string): string {
	const daysAgo =
		card.cancelledDaysAgo ?? card.frozenDaysAgo ?? card.issuedDaysAgo;
	return addDays(today, -daysAgo);
}

/** True when the card can pay on a day `age` days before today: issued, not frozen, not cancelled. */
export function isCardUsable(card: BankCard, age: number): boolean {
	const stopAge = card.cancelledDaysAgo ?? card.frozenDaysAgo;
	return age <= card.issuedDaysAgo && (stopAge === null || age > stopAge);
}
