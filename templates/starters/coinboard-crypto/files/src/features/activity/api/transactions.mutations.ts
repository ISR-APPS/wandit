// The write of a trade: a buy or a sell that the user records in the trade card of the home.
// The trade card calls useRecordTradeMutation. The new row is pending, so no position and no total changes yet.
// The mutationFn adds the row to the sample ledger for this session. A later turn replaces it with a Supabase insert.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	type Account,
	addSampleTransaction,
	roundCents,
	TRADING_FEE_RATIO,
	type TransactionRow,
} from "~/features/ledger";

/** One trade of the trade form, after its zod parse. Amounts are in the app currency. */
export type TradeInput = {
	assetId: string;
	type: "buy" | "sell";
	/** Units of the asset, above 0. A sell is never above the units held. */
	quantity: number;
	/** The current price of one unit. */
	unitPrice: number;
	/** The account that holds the asset: the account of its earlier transactions, or "trading" for a new asset. */
	account: Account;
};

// Four capital hex digits of a random UUID, for the reference code that the user can quote.
function hexPart(): string {
	return crypto.randomUUID().slice(0, 4).toUpperCase();
}

/** Records a trade as a pending transaction. Its onSuccess refreshes the transaction lists and the bell. */
export function useRecordTradeMutation() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (input: TradeInput): Promise<TransactionRow> => {
			const amount = roundCents(input.quantity * input.unitPrice);
			const row: TransactionRow = {
				id: `tx-${crypto.randomUUID()}`,
				reference: `CB-${hexPart()}-${hexPart()}`,
				assetId: input.assetId,
				type: input.type,
				// A trade waits for the exchange. Only a confirmed row moves units, so the totals stay as they are.
				status: "pending",
				account: input.account,
				quantity: input.quantity,
				unitPrice: input.unitPrice,
				amount,
				fee: roundCents(amount * TRADING_FEE_RATIO),
				occurredAt: new Date().toISOString(),
			};
			addSampleTransaction(row);
			return row;
		},
		onSuccess: () =>
			Promise.all([
				queryClient.invalidateQueries({ queryKey: ["transactions"] }),
				queryClient.invalidateQueries({ queryKey: ["alerts"] }),
			]),
	});
}
