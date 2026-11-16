// Reads of market data: the asset list, one asset with its year range, and the price series of one asset.
// The Markets page, the asset page, and the home read them. The route loaders prefetch them.
// Each queryFn reads the sample ledger. A later turn replaces its body with a Supabase call that returns the same type.
import { queryOptions } from "@tanstack/react-query";
import {
	type AssetCategory,
	buildPositionStates,
	changeRatio,
	getSampleLedger,
	type PeriodDays,
	PRICE_STEP_MS,
	type PriceMove,
	priceDaysAgo,
	priceMoveOf,
	priceStepsAgo,
	type SampleLedger,
	STEPS_PER_DAY,
} from "~/features/ledger";
import { buildKeyMoments, type KeyMoment } from "../lib/key-moments";

// The mini chart of a market row covers 7 days, with one price every 6 hours.
const SPARK_STEPS = 7 * STEPS_PER_DAY;
// The year range and the key moments of the asset page read every 6-hour price of the last 365 days.
const YEAR_STEPS = 365 * STEPS_PER_DAY;

/** One asset of the market list. Amounts are in the app currency. */
export type Asset = {
	/** Also the `$assetId` part of the asset page URL. */
	id: string;
	name: string;
	symbol: string;
	category: AssetCategory;
	/** 1 for the largest market size. */
	rank: number;
	/** The current price of one unit. */
	price: number;
	/** The price change of the last 24 hours and of the last 7 days, as ratios. */
	change24h: number;
	change7d: number;
	/** The direction of the last 24 hours. The Markets tabs and the home count it. */
	move: PriceMove;
	/** The price times the units in circulation. */
	marketSize: number;
	/** The traded amount of the last 24 hours. */
	volume24h: number;
	/** The prices of the last 7 days, oldest first, one every 6 hours. */
	spark: number[];
	/** True when the user holds units of the asset. */
	isHeld: boolean;
};

/** One asset with the facts that only its own page shows. */
export type AssetDetail = Asset & {
	/** Two sentences about the project. */
	about: string;
	/** Units in circulation. */
	circulatingSupply: number;
	/** The highest and the lowest 6-hour price of the last 365 days. They contain the range of each chart period. */
	yearHigh: number;
	yearLow: number;
	/** The dated events of the last 365 days, the newest first. */
	moments: KeyMoment[];
};

/** One point of a price chart. */
export type PricePoint = {
	/** Milliseconds since 1970. */
	time: number;
	price: number;
};

function buildAssets(ledger: SampleLedger): Asset[] {
	const states = buildPositionStates(ledger.transactions, ledger.anchor);
	const rows = ledger.assets.map((asset) => {
		const price = priceDaysAgo(ledger, asset.id, 0);
		const change24h =
			changeRatio(price, priceDaysAgo(ledger, asset.id, 1)) ?? 0;
		return {
			id: asset.id,
			name: asset.name,
			symbol: asset.symbol,
			category: asset.category,
			price,
			change24h,
			change7d: changeRatio(price, priceDaysAgo(ledger, asset.id, 7)) ?? 0,
			move: priceMoveOf(change24h),
			marketSize: price * asset.circulatingSupply,
			volume24h: asset.volume24h,
			spark: Array.from({ length: SPARK_STEPS + 1 }, (_, index) =>
				priceStepsAgo(ledger, asset.id, SPARK_STEPS - index),
			),
			isHeld: (states.get(asset.id)?.quantity ?? 0) > 0,
		};
	});
	return rows
		.sort((first, second) => second.marketSize - first.marketSize)
		.map((row, index) => ({ ...row, rank: index + 1 }));
}

/** Every asset, the largest market size first. The Markets page filters, sorts, and pages them in the browser. */
export function assetsQueryOptions() {
	return queryOptions({
		queryKey: ["assets", "list"],
		// LIMIT: every asset in one read, paged in the browser. Upgrade: a limit of 1,000 with server paging (tables-paging.md of the app-dashboard skill).
		queryFn: async (): Promise<Asset[]> => buildAssets(getSampleLedger()),
	});
}

/** One asset with its year range and its key moments. null when the id does not exist. */
export function assetQueryOptions(assetId: string) {
	return queryOptions({
		queryKey: ["assets", "detail", assetId],
		queryFn: async (): Promise<AssetDetail | null> => {
			const ledger = getSampleLedger();
			const asset = buildAssets(ledger).find((row) => row.id === assetId);
			const source = ledger.assets.find((row) => row.id === assetId);
			// The id comes from the URL. An unknown id is "not found", not an error.
			if (!asset || !source) {
				return null;
			}
			// One price per 6-hour step, the oldest first. The last one is the current price.
			// The chart periods read the same steps, so their low and high stay inside the year range.
			const stepPrices = Array.from({ length: YEAR_STEPS + 1 }, (_, index) =>
				priceStepsAgo(ledger, assetId, YEAR_STEPS - index),
			);
			return {
				...asset,
				about: source.about,
				circulatingSupply: source.circulatingSupply,
				yearHigh: Math.max(...stepPrices),
				yearLow: Math.min(...stepPrices),
				moments: buildKeyMoments(
					stepPrices,
					ledger.anchor,
					ledger.transactions.filter(
						(row) => row.assetId === assetId && row.status === "confirmed",
					),
				),
			};
		},
	});
}

/**
 * The prices of one asset for the last `days` days, oldest first. The last point is the current price.
 * 7 and 30 days give one point every 6 hours. 90 days gives one point per day.
 */
export function assetPricesQueryOptions(assetId: string, days: PeriodDays) {
	return queryOptions({
		queryKey: ["assets", "prices", assetId, days],
		queryFn: async (): Promise<PricePoint[]> => {
			const ledger = getSampleLedger();
			// 90 days of 6-hour points is 361 points: too dense for the plot width.
			const stepsPerPoint = days === 90 ? STEPS_PER_DAY : 1;
			const pointCount = (days * STEPS_PER_DAY) / stepsPerPoint;
			return Array.from({ length: pointCount + 1 }, (_, index) => {
				const stepsAgo = (pointCount - index) * stepsPerPoint;
				return {
					time: ledger.anchor - stepsAgo * PRICE_STEP_MS,
					price: priceStepsAgo(ledger, assetId, stepsAgo),
				};
			});
		},
	});
}
