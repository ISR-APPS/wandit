// A small random number generator with a seed (the mulberry32 algorithm).
// The sample modules of this feature call it. The same seed gives the same rows on every load.
// No file calls Math.random(), so the pages never change between two renders.

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

/** One seed from a day number and a salt. Each kind of row has its own salt, so two kinds never share a stream. */
export function seedOf(dayNumber: number, salt: number): number {
	// Two odd multipliers spread near numbers (two days in a row) over the 32 bits.
	return (
		(Math.imul(dayNumber, 0x9e3779b1) ^ Math.imul(salt + 1, 0x85ebca6b)) >>> 0
	);
}

/** A whole number from `min` to `max`, both included. */
export function randomInt(
	random: () => number,
	min: number,
	max: number,
): number {
	return min + Math.floor(random() * (max - min + 1));
}

/** What the pick functions accept: a text, a number, or one plain record of sample data. */
type PickItem = string | number | Record<string, unknown>;

/** One item of a list that is not empty. Each item has the same chance. */
export function pickOne<Item extends PickItem>(
	random: () => number,
	items: readonly [Item, ...Item[]],
): Item {
	return items[Math.floor(random() * items.length)] ?? items[0];
}

/** One value of a list of `[value, weight]` pairs. A weight of 3 comes three times as often as a weight of 1. */
export function pickWeighted<Item extends PickItem>(
	random: () => number,
	options: readonly [readonly [Item, number], ...(readonly [Item, number])[]],
): Item {
	const total = options.reduce((sum, [, weight]) => sum + weight, 0);
	let cursor = random() * total;
	for (const [item, weight] of options) {
		cursor -= weight;
		if (cursor < 0) {
			return item;
		}
	}
	return options[0][0];
}

/** `count` different items of `items`, in a random order. Fewer when the list is shorter. */
export function pickSome<Item extends PickItem>(
	random: () => number,
	items: readonly Item[],
	count: number,
): Item[] {
	const pool = [...items];
	const picked: Item[] = [];
	while (picked.length < count && pool.length > 0) {
		const [item] = pool.splice(Math.floor(random() * pool.length), 1);
		if (item !== undefined) {
			picked.push(item);
		}
	}
	return picked;
}
