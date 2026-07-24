// Query keys and the poll-friendly payment-order query. Callers own the
// polling cadence so return pages can stop on their exact terminal states and
// enforce their own timeout.

import { useQuery } from "@tanstack/react-query";

import type { PaymentOrder } from "./orders.dto";
import { getOrder } from "./orders.services";

export const orderKeys = {
	all: ["orders"] as const,
	details: () => [...orderKeys.all, "detail"] as const,
	detail: (orderId: string) => [...orderKeys.details(), orderId] as const,
};

export type OrderQueryOptions = {
	enabled?: boolean;
	refetchInterval?:
		| false
		| number
		| ((order: PaymentOrder | undefined) => false | number);
};

export function useOrderQuery(
	orderId: string | undefined,
	options: OrderQueryOptions = {},
) {
	const { enabled = true, refetchInterval = false } = options;

	return useQuery({
		queryKey: orderKeys.detail(orderId ?? "none"),
		queryFn: () => getOrder(orderId as string),
		enabled: enabled && Boolean(orderId),
		refetchInterval:
			typeof refetchInterval === "function"
				? (query) => refetchInterval(query.state.data)
				: refetchInterval,
	});
}
