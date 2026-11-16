// A small random generator with a fixed seed (mulberry32).
// sample-data.ts builds the price history and the transactions with it.
// The same seed gives the same numbers, so the rows are stable between renders.

/** Returns a function that gives the next number from 0 (included) to 1 (excluded). */
export function createRandom(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let mixed = state;
		mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
		mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
		// 2^32: the result stays under 1.
		return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
	};
}

/** A number near 0 with a bell shape, about -3 to 3. A price step uses it as its random part. */
export function nextBell(random: () => number): number {
	// The sum of 4 uniform numbers has a variance of 4/12. The factor gives a variance of 1.
	return (random() + random() + random() + random() - 2) * Math.sqrt(3);
}
