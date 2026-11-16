// Reads of positions: what the user holds of each asset, with its cost, its value, and its profit.
// The home, the Holdings page, and the asset page read them. The route loaders prefetch them.
// Each queryFn reads the sample ledger. A later turn replaces its body with a Supabase call that returns the same type.
import { queryOptions } from "@tanstack/react-query";
import {
	type Account,
	type AssetCategory,
	buildPositionStates,
	changeRatio,
	getSampleLedger,
	priceDaysAgo,
	roundCents,
	type SampleLedger,
} from "~/features/ledger";

/** One held asset. Amounts are in the app currency, with cents. */
export type Position = {
	/** The asset id. DataTable keys its rows by it, and the asset page URL uses it. */
	id: string;
	name: string;
	symbol: string;
	category: AssetCategory;
	/** The account that holds the units. */
	account: Account;
	/** Units held. */
	quantity: number;
	/** The current price of one unit. */
	price: number;
	/** The price change of the last 24 hours, as a ratio. */
	change24h: number;
	/** `quantity` times `price`. */
	value: number;
	/** What the held units cost, by the average cost method. */
	costBasis: number;
	/** `costBasis` divided by `quantity`: the mean price that the user paid for one unit. */
	averageCost: number;
	/** `value` minus `costBasis`. Negative for a loss. */
	profit: number;
	/** `profit` as a ratio of `costBasis`. null when the cost is 0. */
	profitRatio: number | null;
	/** The part of the whole portfolio value, as a ratio. */
	share: number;
};

/** The position of one asset on its own page. It also covers an asset that the user sold completely. */
export type AssetPosition = {
	/** null when the user holds no unit now. */
	held: Position | null;
	/** The profit of the units already sold, in the app currency. */
	realizedProfit: number;
};

// Every position with units, the largest value first. A SQL view does this math later.
function buildPositions(ledger: SampleLedger): Position[] {
	const states = buildPositionStates(ledger.transactions, ledger.anchor);
	const rows = ledger.assets.flatMap((asset) => {
		const state = states.get(asset.id);
		// The account of an asset is the account of its transactions.
		const account = ledger.transactions.find(
			(row) => row.assetId === asset.id,
		)?.account;
		if (!state || state.quantity === 0 || !account) {
			return [];
		}
		const price = priceDaysAgo(ledger, asset.id, 0);
		const value = roundCents(state.quantity * price);
		const costBasis = roundCents(state.costBasis);
		return [
			{
				id: asset.id,
				name: asset.name,
				symbol: asset.symbol,
				category: asset.category,
				account,
				quantity: state.quantity,
				price,
				change24h: changeRatio(price, priceDaysAgo(ledger, asset.id, 1)) ?? 0,
				value,
				costBasis,
				averageCost: state.costBasis / state.quantity,
				profit: roundCents(value - costBasis),
				profitRatio: changeRatio(value, costBasis),
			},
		];
	});
	const total = rows.reduce((sum, row) => sum + row.value, 0);
	return rows
		.map((row) => ({ ...row, share: total === 0 ? 0 : row.value / total }))
		.sort((first, second) => second.value - first.value);
}

/** Every held asset, the largest value first. The pages filter and sort them in the browser. */
export function positionsQueryOptions() {
	return queryOptions({
		queryKey: ["positions", "list"],
		// LIMIT: every position in one read. A user holds some tens of assets. Upgrade: server paging (tables-paging.md of the app-dashboard skill).
		queryFn: async (): Promise<Position[]> => buildPositions(getSampleLedger()),
	});
}

/** The position of one asset, with the profit of its past sales. `held` is null for an asset with no unit now. */
export function assetPositionQueryOptions(assetId: string) {
	return queryOptions({
		queryKey: ["positions", "asset", assetId],
		queryFn: async (): Promise<AssetPosition> => {
			const ledger = getSampleLedger();
			const state = buildPositionStates(ledger.transactions, ledger.anchor).get(
				assetId,
			);
			return {
				held: buildPositions(ledger).find((row) => row.id === assetId) ?? null,
				realizedProfit: roundCents(state?.realizedProfit ?? 0),
			};
		},
	});
}
