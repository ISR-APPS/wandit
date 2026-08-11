// Mutations for creating and reconciling payment orders. Reconciliation seeds
// the detail cache so polling can continue from the canonical returned state.

import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { CreateDomainOrderBody, ReconcileSessionBody } from "./orders.dto";
import { orderKeys } from "./orders.queries";
import { reconcileSessionIntoCache } from "./orders.reconciliation";
import { createDomainOrder } from "./orders.services";

export function useCreateDomainOrder() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (body: CreateDomainOrderBody) => createDomainOrder(body),
		onSuccess: ({ order }) => {
			queryClient.setQueryData(orderKeys.detail(order.id), order);
		},
	});
}

export function useReconcileSession() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (body: ReconcileSessionBody) =>
			reconcileSessionIntoCache(queryClient, body),
	});
}
