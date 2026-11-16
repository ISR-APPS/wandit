// Reads of transactions: the whole log, and the log of one asset.
// The Activity page, the home, and the asset page read them. The route loaders prefetch them.
// Each queryFn reads the sample ledger. A later turn replaces its body with a Supabase call that returns the same type.
import { queryOptions } from "@tanstack/react-query";
import {
	type Account,
	type AssetCategory,
	getSampleLedger,
	type SampleLedger,
	type TransactionStatus,
	type TransactionType,
} from "~/features/ledger";

/** One transaction with the name of its asset. Amounts are in the app currency, with cents. */
export type Transaction = {
	id: string;
	/** A short code that the user can quote, for example "CB-7F3A-21C9". */
	reference: string;
	assetId: string;
	assetName: string;
	assetSymbol: string;
	assetCategory: AssetCategory;
	type: TransactionType;
	status: TransactionStatus;
	/** The account that holds the asset. */
	account: Account;
	/** Units of the asset. Always positive; the type gives the direction. */
	quantity: number;
	/** The price of one unit at the time of the transaction. */
	unitPrice: number;
	/** `quantity` times `unitPrice`. */
	amount: number;
	/** The trading or network fee. 0 for a deposit and a reward. */
	fee: number;
	/** ISO time. */
	occurredAt: string;
};

// Adds the asset names to the rows, the newest first. A database join does this later.
function withAssets(ledger: SampleLedger, assetId?: string): Transaction[] {
	const assets = new Map(ledger.assets.map((asset) => [asset.id, asset]));
	return ledger.transactions
		.flatMap((row) => {
			const asset = assets.get(row.assetId);
			if (!asset || (assetId !== undefined && row.assetId !== assetId)) {
				return [];
			}
			return [
				{
					...row,
					assetName: asset.name,
					assetSymbol: asset.symbol,
					assetCategory: asset.category,
				},
			];
		})
		.reverse();
}

/** Every transaction, the newest first. The Activity page filters, searches, and pages them in the browser. */
export function transactionsQueryOptions() {
	return queryOptions({
		queryKey: ["transactions", "list"],
		// LIMIT: every transaction in one read, paged in the browser. Upgrade: a limit of 1,000 with server paging (tables-paging.md of the app-dashboard skill).
		queryFn: async (): Promise<Transaction[]> => withAssets(getSampleLedger()),
	});
}

/** The transactions of one asset, the newest first. An unknown asset id gives an empty list. */
export function assetTransactionsQueryOptions(assetId: string) {
	return queryOptions({
		queryKey: ["transactions", "asset", assetId],
		queryFn: async (): Promise<Transaction[]> =>
			withAssets(getSampleLedger(), assetId),
	});
}
