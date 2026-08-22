export type ConcurrentMapResult<Result> =
	| { index: number; status: "fulfilled"; value: Result }
	| { index: number; reason: unknown; status: "rejected" };

export type MapWithConcurrencyOptions = {
	/** Checked immediately before a worker claims its next item. */
	shouldStart?: () => boolean;
};

/**
 * Order-preserving, all-settled worker pool. A rejected item stops new work
 * from being claimed, while work that was already started is allowed to drain.
 */
export async function mapWithConcurrency<Item, Result>(
	items: readonly Item[],
	concurrency: number,
	mapper: (item: Item, index: number) => Promise<Result>,
	options: MapWithConcurrencyOptions = {},
): Promise<ConcurrentMapResult<Result>[]> {
	if (!Number.isInteger(concurrency) || concurrency < 1) {
		throw new RangeError("concurrency must be a positive integer");
	}

	const results: Array<ConcurrentMapResult<Result> | undefined> = new Array(
		items.length,
	);
	let nextIndex = 0;
	let stopped = false;

	const workers = Array.from(
		{ length: Math.min(concurrency, items.length) },
		async () => {
			while (!stopped && (options.shouldStart?.() ?? true)) {
				const index = nextIndex;

				if (index >= items.length) {
					return;
				}

				nextIndex += 1;
				const item = items[index] as Item;

				try {
					results[index] = {
						index,
						status: "fulfilled",
						value: await mapper(item, index),
					};
				} catch (reason) {
					results[index] = { index, reason, status: "rejected" };
					stopped = true;
				}
			}
		},
	);

	await Promise.all(workers);

	return results.filter(
		(result): result is ConcurrentMapResult<Result> => result !== undefined,
	);
}
