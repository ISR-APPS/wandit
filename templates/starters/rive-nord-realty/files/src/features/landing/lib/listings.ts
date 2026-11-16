// The homes of the register, the hero ticker, and the window.
// HeroSection, RegisterSection, ListingRow, and ShopWindow read them. The texts live in the `listing` group of messages.ts.
// Every home, street, and price is fictional sample content.
import type { TranslationKey } from "~/shared/i18n";
import type { DistrictId } from "./districts";

/** The drawn facades of components/facade.tsx, one per home. */
export type FacadeId =
	| "tall-block"
	| "stepped"
	| "arcades"
	| "tower"
	| "stair-core"
	| "stone"
	| "rotunda"
	| "cottage";

/** The board status of a home. It picks the stamp: none, "New", "Price cut", or "Sold". */
export type ListingStatus = "listed" | "new" | "price-cut" | "sold";

/** One home of the register. */
export type Listing = {
	/** Agency reference, printed on the board and in the email subject. */
	ref: string;
	district: DistrictId;
	facade: FacadeId;
	status: ListingStatus;
	/** Street and building, for example "Linden Rise — 1954 block". */
	streetKey: TranslationKey;
	/** Bedrooms, floor, and lift, for example "2 bed · 4th floor · lift". */
	layoutKey: TranslationKey;
	/** The one feature that sells it, for example "dual aspect". */
	featureKey: TranslationKey;
	/** When it went up on the board, relative to today, for example "Posted yesterday". */
	postedKey: TranslationKey;
	/** Accessible name of the facade drawing. */
	artKey: TranslationKey;
	/** Living area in square metres. */
	areaSqm: number;
	/** Asking price in euros. For a sold home, the signed price. */
	price: number;
	/** The price before the cut, in euros. Only a "price-cut" home has it. */
	previousPrice?: number;
};

/** Board order: newest posting first, the sold home last. */
export const LISTINGS: readonly Listing[] = [
	{
		ref: "RN-2041",
		district: "heights",
		facade: "tall-block",
		status: "new",
		streetKey: "listing.rn2041Street",
		layoutKey: "listing.rn2041Layout",
		featureKey: "listing.rn2041Feature",
		postedKey: "listing.postedToday",
		artKey: "listing.rn2041Art",
		areaSqm: 92,
		price: 412000,
	},
	{
		ref: "RN-2038",
		district: "heights",
		facade: "stepped",
		status: "new",
		streetKey: "listing.rn2038Street",
		layoutKey: "listing.rn2038Layout",
		featureKey: "listing.rn2038Feature",
		postedKey: "listing.postedYesterday",
		artKey: "listing.rn2038Art",
		areaSqm: 118,
		price: 565000,
	},
	{
		ref: "RN-2036",
		district: "old-town",
		facade: "arcades",
		status: "listed",
		streetKey: "listing.rn2036Street",
		layoutKey: "listing.rn2036Layout",
		featureKey: "listing.rn2036Feature",
		postedKey: "listing.posted3Days",
		artKey: "listing.rn2036Art",
		areaSqm: 54,
		price: 189000,
	},
	{
		ref: "RN-2033",
		district: "east-quay",
		facade: "tower",
		status: "listed",
		streetKey: "listing.rn2033Street",
		layoutKey: "listing.rn2033Layout",
		featureKey: "listing.rn2033Feature",
		postedKey: "listing.posted5Days",
		artKey: "listing.rn2033Art",
		areaSqm: 78,
		price: 268000,
	},
	{
		ref: "RN-2029",
		district: "east-quay",
		facade: "stair-core",
		status: "listed",
		streetKey: "listing.rn2029Street",
		layoutKey: "listing.rn2029Layout",
		featureKey: "listing.rn2029Feature",
		postedKey: "listing.postedLastWeek",
		artKey: "listing.rn2029Art",
		areaSqm: 82,
		price: 289000,
	},
	{
		ref: "RN-2027",
		district: "belvedere",
		facade: "stone",
		status: "listed",
		streetKey: "listing.rn2027Street",
		layoutKey: "listing.rn2027Layout",
		featureKey: "listing.rn2027Feature",
		postedKey: "listing.posted2Weeks",
		artKey: "listing.rn2027Art",
		areaSqm: 140,
		price: 532000,
	},
	{
		ref: "RN-2024",
		district: "old-town",
		facade: "rotunda",
		status: "price-cut",
		streetKey: "listing.rn2024Street",
		layoutKey: "listing.rn2024Layout",
		featureKey: "listing.rn2024Feature",
		postedKey: "listing.posted3Months",
		artKey: "listing.rn2024Art",
		areaSqm: 85,
		price: 331000,
		previousPrice: 352000,
	},
	{
		ref: "RN-2019",
		district: "belvedere",
		facade: "cottage",
		status: "sold",
		streetKey: "listing.rn2019Street",
		layoutKey: "listing.rn2019Layout",
		featureKey: "listing.rn2019Feature",
		postedKey: "listing.soldLastWeek",
		artKey: "listing.rn2019Art",
		areaSqm: 58,
		price: 214000,
	},
];

/** The stamp text of each status. A "listed" home has no stamp. */
export const STATUS_STAMP_KEYS: Record<
	Exclude<ListingStatus, "listed">,
	TranslationKey
> = {
	new: "ticker.new",
	"price-cut": "ticker.priceCut",
	sold: "ticker.sold",
};

/** Price per square metre in euros, rounded to 10 € as the board prints it. */
export function pricePerSqm(listing: Listing): number {
	return Math.round(listing.price / listing.areaSqm / 10) * 10;
}
