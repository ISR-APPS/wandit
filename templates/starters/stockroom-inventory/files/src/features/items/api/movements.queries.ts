// Reads of stock movements across all items: the newest receipts, counts, and damage of the warehouse.
// The home loader prefetches them; the latest movements card of the home reads them.
// The queryFn reads the sample tables. A later turn replaces its body with a Supabase call that returns the same type.
import { queryOptions } from "@tanstack/react-query";
import {
	getSampleTables,
	type MovementReason,
	type StockUnit,
} from "~/features/stock";

/** One movement with the item facts that a warehouse-wide list shows. */
export type MovementListRow = {
	id: string;
	itemId: string;
	itemName: string;
	sku: string;
	bin: string;
	unit: StockUnit;
	reason: MovementReason;
	/** Signed units: positive for a receipt. */
	quantity: number;
	/** The pick ticket, order number, count sheet, or damage report. */
	reference: string;
	occurredAt: string;
};

/** The `count` newest movements of every item that are not picks, newest first. The picks chart of the home sums the picks. */
export function latestStockChangesQueryOptions(count: number) {
	return queryOptions({
		queryKey: ["movements", "latest-changes", count],
		queryFn: async (): Promise<MovementListRow[]> => {
			const tables = getSampleTables();
			const itemById = new Map(tables.items.map((item) => [item.id, item]));
			// About 40 picks a day hide every other movement, so the list skips them.
			const changes = tables.movements
				.filter((movement) => movement.reason !== "pick")
				.slice(0, count);
			return changes.flatMap((movement) => {
				const item = itemById.get(movement.itemId);
				return item
					? [
							{
								id: movement.id,
								itemId: item.id,
								itemName: item.name,
								sku: item.sku,
								bin: item.bin,
								unit: item.unit,
								reason: movement.reason,
								quantity: movement.quantity,
								reference: movement.reference,
								occurredAt: movement.occurredAt,
							},
						]
					: [];
			});
		},
	});
}
