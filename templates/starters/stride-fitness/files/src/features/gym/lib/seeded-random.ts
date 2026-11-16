// A small random number generator with a seed (the mulberry32 algorithm).
// The sample modules of the gym call it. The same seed gives the same rows on every load.
// No file calls Math.random(), so the pages never change between two renders.

/** A function that gives the next number, from 0 (included) to 1 (excluded). */
export type Random = () => number;

/** Returns a generator. Two generators with the same seed give the same numbers. */
export function createSeededRandom(seed: number): Random {
	let state = seed >>> 0;
	return () => {
		// The constants come from mulberry32. They spread the bits of the state.
		state = (state + 0x6d2b79f5) >>> 0;
		let mixed = Math.imul(state ^ (state >>> 15), state | 1);
		mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
		// 2 ** 32 turns the 32-bit integer into a share from 0 to 1.
		return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
	};
}

/** A whole number from `min` to `max`, both included. */
export function randomInt(random: Random, min: number, max: number): number {
	return min + Math.floor(random() * (max - min + 1));
}

/**
 * Picks up to `count` different indexes. A weight of 3 comes three times as often as a weight of 1.
 * An index with a weight of 0 is never picked. It returns fewer indexes when fewer weights are above 0.
 */
export function pickWeightedIndexes(
	random: Random,
	weights: readonly number[],
	count: number,
): number[] {
	const left = [...weights];
	const picked: number[] = [];
	let total = left.reduce((sum, weight) => sum + weight, 0);
	while (picked.length < count && total > 0) {
		let cursor = random() * total;
		let chosen = -1;
		for (const [index, weight] of left.entries()) {
			if (weight <= 0) {
				continue;
			}
			// When float rounding leaves the cursor above 0, the last index with a weight wins.
			chosen = index;
			cursor -= weight;
			if (cursor < 0) {
				break;
			}
		}
		if (chosen < 0) {
			break;
		}
		total -= left[chosen] ?? 0;
		left[chosen] = 0;
		picked.push(chosen);
	}
	return picked;
}
