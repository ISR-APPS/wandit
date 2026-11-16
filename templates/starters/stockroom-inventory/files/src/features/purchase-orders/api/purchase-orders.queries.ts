// Reads of purchase orders: every order with its lines, its deliveries, and its late days.
// The /app/purchase-orders route prefetches the list. The home rail and the supplier panel read it too.
// The queryFn reads the sample tables. A later turn replaces its body with a Supabase call that returns the same type.
import { queryOptions } from "@tanstack/react-query";
import {
	getSampleTables,
	lateDaysOf,
	type PurchaseOrderStatus,
	type ReceiptRow,
	type StockUnit,
} from "~/features/stock";

/** One line of an order, with the item facts that the panel shows. */
export type PurchaseOrderLine = {
	itemId: string;
	sku: string;
	itemName: string;
	unit: StockUnit;
	quantityOrdered: number;
	/** Never above quantityOrdered. */
	quantityReceived: number;
	/** The agreed price of one unit, in the stock currency. */
	unitCost: number;
	/** quantityOrdered times unitCost. */
	total: number;
};

/** One purchase order with its totals. The times are ISO texts. */
export type PurchaseOrder = {
	/** The lower case number. It is the `po` search value of the order panel. */
	id: string;
	/** The number on the paperwork, for example "PO-24117". */
	number: string;
	supplierId: string;
	supplierName: string;
	status: PurchaseOrderStatus;
	/** Full days past the expected day. 0 when on time or closed. */
	lateDays: number;
	createdAt: string;
	/** null for a draft. */
	orderedAt: string | null;
	/** Local midnight of the promised day. */
	expectedOn: string;
	cancelledAt: string | null;
	/** Oldest first. */
	receipts: ReceiptRow[];
	lines: PurchaseOrderLine[];
	/** The sum of the line totals, in the stock currency. */
	total: number;
	unitsOrdered: number;
	unitsReceived: number;
};

/** Every order, newest first. The list page filters, searches, sorts, and pages them in the browser. */
export function purchaseOrdersQueryOptions() {
	return queryOptions({
		queryKey: ["purchase-orders", "list"],
		queryFn: async (): Promise<PurchaseOrder[]> => {
			const tables = getSampleTables();
			const itemById = new Map(tables.items.map((item) => [item.id, item]));
			const supplierName = new Map(
				tables.suppliers.map((supplier) => [supplier.id, supplier.name]),
			);
			return tables.purchaseOrders.map((order) => {
				const lines = order.lines.flatMap((line) => {
					const item = itemById.get(line.itemId);
					return item
						? [
								{
									itemId: item.id,
									sku: item.sku,
									itemName: item.name,
									unit: item.unit,
									quantityOrdered: line.quantityOrdered,
									quantityReceived: line.quantityReceived,
									unitCost: line.unitCost,
									total: line.quantityOrdered * line.unitCost,
								},
							]
						: [];
				});
				return {
					id: order.id,
					number: order.number,
					supplierId: order.supplierId,
					supplierName: supplierName.get(order.supplierId) ?? "",
					status: order.status,
					lateDays: lateDaysOf(order, tables.todayStart),
					createdAt: order.createdAt,
					orderedAt: order.orderedAt,
					expectedOn: order.expectedOn,
					cancelledAt: order.cancelledAt,
					receipts: order.receipts,
					lines,
					total: lines.reduce((sum, line) => sum + line.total, 0),
					unitsOrdered: lines.reduce(
						(sum, line) => sum + line.quantityOrdered,
						0,
					),
					unitsReceived: lines.reduce(
						(sum, line) => sum + line.quantityReceived,
						0,
					),
				};
			});
		},
	});
}
