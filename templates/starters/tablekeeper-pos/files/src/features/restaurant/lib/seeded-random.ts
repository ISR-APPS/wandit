// A small random number generator with a seed (the mulberry32 algorithm).
// The sample modules of the restaurant feature call it to build stable rows.
// The same seed gives the same rows on every load. No file calls Math.random().

/** Returns a function that gives the next number, from 0 (included) to 1 (excluded). */
export function createSeededRandom(seed: number): () => number {
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
export function randomInt(
	random: () => number,
	min: number,
	max: number,
): number {
	return min + Math.floor(random() * (max - min + 1));
}

/** One item of a list that is not empty. Each item has the same chance. */
export function pickOne<Item>(
	random: () => number,
	items: readonly [Item, ...Item[]],
): Item {
	return items[Math.floor(random() * items.length)] ?? items[0];
}
