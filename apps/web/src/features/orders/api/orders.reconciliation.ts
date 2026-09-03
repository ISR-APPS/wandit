// Shared checkout reconciliation seeds the canonical order cache for both the
// billing return page and origin-page checkout returns.

import type { QueryClient } from "@tanstack/react-query";

import type { PaymentOrder, ReconcileSessionBody } from "./orders.dto";
import { orderKeys } from "./orders.queries";
import { reconcileSession } from "./orders.services";

export async function reconcileSessionIntoCache(
	queryClient: QueryClient,
	body: ReconcileSessionBody,
): Promise<PaymentOrder> {
	const order = await reconcileSession(body);
	queryClient.setQueryData(orderKeys.detail(order.id), order);
	return order;
}
