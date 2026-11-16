// The fixed code lists of the ledger: asset categories, accounts, transaction types, and transaction statuses.
// The sample data, the query files, and the pages of every feature read them.
// Each code has a label in messages.ts under `ledger.<list>.<code>`. A later database keeps the codes as check constraints.
import type { VariantProps } from "class-variance-authority";
import type { badgeVariants } from "~/shared/ui/badge";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

/** The category of an asset. The Markets filter and the asset page show it. */
export const ASSET_CATEGORIES = [
	"layer1",
	"defi",
	"stablecoin",
	"infrastructure",
	"payments",
	"gaming",
] as const;

/** One asset category. Its label is the message key `ledger.categories.<category>`. */
export type AssetCategory = (typeof ASSET_CATEGORIES)[number];

/** Where the user keeps an asset. Each held asset lives in one account. */
export const ACCOUNTS = ["vault", "staking", "trading"] as const;

/** One account. Its label is the message key `ledger.accounts.<account>`. */
export type Account = (typeof ACCOUNTS)[number];

/** The types of a transaction, in the order of the Activity tabs. */
export const TRANSACTION_TYPES = [
	"buy",
	"sell",
	"deposit",
	"withdrawal",
	"reward",
] as const;

/** One transaction type. Its label is the message key `ledger.types.<type>`. */
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

/** A buy, a deposit, and a reward add units to a position. A sell and a withdrawal remove units. */
export const UNIT_DIRECTION = {
	buy: 1,
	sell: -1,
	deposit: 1,
	withdrawal: -1,
	reward: 1,
} satisfies Record<TransactionType, 1 | -1>;

/** The statuses of a transaction. Only a confirmed transaction changes a position. */
export const TRANSACTION_STATUSES = ["confirmed", "pending", "failed"] as const;

/** One transaction status. Its label is the message key `ledger.statuses.<status>`. */
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

/** Badge variant per status. Failed is the only red one, confirmed the only green one. */
export const TRANSACTION_STATUS_BADGE = {
	confirmed: "success",
	pending: "warning",
	failed: "destructive",
} satisfies Record<TransactionStatus, BadgeVariant>;

/** The direction of a price over 24 hours. The home counts the assets of each one; the Markets tabs filter by it. */
export const PRICE_MOVES = ["rising", "flat", "falling"] as const;

/** One price direction. Its label is the message key `ledger.moves.<move>`. */
export type PriceMove = (typeof PRICE_MOVES)[number];

/** Badge variant per price direction. */
export const PRICE_MOVE_BADGE = {
	rising: "success",
	flat: "secondary",
	falling: "destructive",
} satisfies Record<PriceMove, BadgeVariant>;

/** A change under 0.5 % reads as flat. A stablecoin always falls in this band. ChangeText shows it muted. */
export const FLAT_MOVE_RATIO = 0.005;

/** The direction of a 24-hour change, given as a ratio: 0.012 is rising, -0.002 is flat. */
export function priceMoveOf(change: number): PriceMove {
	if (Math.abs(change) < FLAT_MOVE_RATIO) {
		return "flat";
	}
	return change > 0 ? "rising" : "falling";
}
