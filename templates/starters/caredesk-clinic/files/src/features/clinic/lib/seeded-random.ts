// A small random number generator with a seed (the mulberry32 algorithm).
// The sample modules of this feature call it. The same seed gives the same rows on every load.
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

/** One item of a list that is not empty. Each item has the same chance. */
export function pickOne<Item>(
	random: Random,
	items: readonly [Item, ...Item[]],
): Item {
	return items[Math.floor(random() * items.length)] ?? items[0];
}

/** The index of one weight of the list. A weight of 3 comes three times as often as a weight of 1. Returns -1 when every weight is 0. */
export function pickWeightedIndex(
	random: Random,
	weights: readonly number[],
): number {
	const total = weights.reduce((sum, weight) => sum + weight, 0);
	if (total <= 0) {
		return -1;
	}
	let cursor = random() * total;
	for (const [index, weight] of weights.entries()) {
		cursor -= weight;
		if (cursor < 0) {
			return index;
		}
	}
	return weights.length - 1;
}

/**
 * A share from 0 to 1 that depends only on the pair (`seed`, `index`).
 * A list of keys made with it stays the same when one other key of the list changes.
 */
export function hashShare(seed: number, index: number): number {
	// 0x9e3779b1 is the golden ratio in 32 bits. It puts two close indexes far apart before the mix.
	return createSeededRandom((seed ^ Math.imul(index, 0x9e3779b1)) >>> 0)();
}
