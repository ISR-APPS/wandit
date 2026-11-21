// Stock levels at a past time, rebuilt from today's on-hand quantity and the movements after that time.
// The home figures and the item list figures compare the level of now with the level at the start of a period.
// A real database keeps a daily snapshot table instead (STARTER.md).
import type { SampleTables } from "./sample-data";

/** On-hand units of each item at the time `at` (ms since 1970). Map key: the item id. */
export function onHandAt(
	tables: SampleTables,
	at: number,
): Map<string, number> {
	const levels = new Map(tables.items.map((item) => [item.id, item.onHand]));
	// Movements are newest first: undo each one that happened after `at`, then stop.
	for (const movement of tables.movements) {
		if (Date.parse(movement.occurredAt) < at) {
			break;
		}
		levels.set(
			movement.itemId,
			(levels.get(movement.itemId) ?? 0) - movement.quantity,
		);
	}
	return levels;
}
