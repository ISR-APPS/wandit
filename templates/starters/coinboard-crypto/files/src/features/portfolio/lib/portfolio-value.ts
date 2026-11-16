// The value math of the whole portfolio: its value at a past price step, and the allocation by asset category.
// portfolio.queries.ts and the home tiles call it. A SQL read function does the same sums later.
import {
	ASSET_CATEGORIES,
	type AssetCategory,
	buildPositionStates,
	PRICE_STEP_MS,
	priceStepsAgo,
	roundCents,
	type SampleLedger,
} from "~/features/ledger";

/** One part of the allocation: the held assets of one category. */
export type AllocationPart = {
	category: AssetCategory;
	/** The value of the held assets of the category, in the app currency. */
	value: number;
	/** Count of held assets in the category. */
	assetCount: number;
	/** The part of the whole value in tenths of a percent: 365 is 36.5 %. The parts add up to 1000. */
	shareTenths: number;
};

/**
 * The value of the portfolio `stepsAgo` steps of 6 hours before the start of today: the units held then, at the prices of then.
 * 0 steps ago is the current value. Each asset is rounded to cents first, so the total equals the sum of the Holdings rows.
 */
export function portfolioValueStepsAgo(
	ledger: SampleLedger,
	stepsAgo: number,
): number {
	const states = buildPositionStates(
		ledger.transactions,
		ledger.anchor - stepsAgo * PRICE_STEP_MS,
	);
	let total = 0;
	for (const state of states.values()) {
		total += roundCents(
			state.quantity * priceStepsAgo(ledger, state.assetId, stepsAgo),
		);
	}
	return roundCents(total);
}

/**
 * One part per category that has a held asset, the largest value first.
 * The shares use the largest remainder method, so the rounded shares that the tile shows add up to exactly 100 %.
 */
export function buildAllocation(
	positions: { category: AssetCategory; value: number }[],
): AllocationPart[] {
	const total = positions.reduce((sum, row) => sum + row.value, 0);
	const parts = ASSET_CATEGORIES.flatMap((category) => {
		const rows = positions.filter((row) => row.category === category);
		const value = roundCents(rows.reduce((sum, row) => sum + row.value, 0));
		// 1000 tenths are 100 %. The floor leaves a rest that the loop below gives out.
		const exactTenths = total === 0 ? 0 : (value / total) * 1000;
		return rows.length === 0
			? []
			: [
					{
						category,
						value,
						assetCount: rows.length,
						shareTenths: Math.floor(exactTenths),
						remainder: exactTenths - Math.floor(exactTenths),
					},
				];
	});
	const missingTenths =
		total === 0
			? 0
			: 1000 - parts.reduce((sum, part) => sum + part.shareTenths, 0);
	// The missing tenths go to the parts with the largest rest, one tenth each.
	const byRemainder = [...parts].sort(
		(first, second) => second.remainder - first.remainder,
	);
	for (const part of byRemainder.slice(0, missingTenths)) {
		part.shareTenths += 1;
	}
	return parts
		.sort((first, second) => second.value - first.value)
		.map((part) => ({
			category: part.category,
			value: part.value,
			assetCount: part.assetCount,
			shareTenths: part.shareTenths,
		}));
}
