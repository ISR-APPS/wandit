import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";

import { reconcileSessionIntoCache } from "@/features/orders/api/orders.reconciliation";
import {
	type DomainCheckoutReturn,
	domainCheckoutReturnFromSearch,
	withoutCheckoutReturnParams,
} from "@/features/orders/lib/checkout-return";
import { domainKeys } from "../api/domains.queries";

const handledCheckoutCancellations = new Set<string>();
const checkoutReconciliations = new Map<string, Promise<void>>();

const PURCHASED_TOAST =
	"Domain purchased — we are configuring it now. It will be live in a few minutes.";
const CANCELED_TOAST = "Checkout canceled — you were not charged.";

function checkoutReturnKey(
	checkoutReturn: DomainCheckoutReturn,
	pathname: string,
) {
	return checkoutReturn.kind === "success"
		? `success:${checkoutReturn.sessionId}`
		: `cancel:${pathname}`;
}

export function useDomainCheckoutReturn(projectId: string) {
	const queryClient = useQueryClient();
	const router = useRouter();
	// Route validation intentionally exposes only workspace-owned search. Read
	// the raw string so Stripe's callback values still reach this shared page.
	const search = useLocation({ select: (location) => location.searchStr });

	useEffect(() => {
		const checkoutReturn = domainCheckoutReturnFromSearch(search);

		if (!checkoutReturn) {
			return;
		}

		const key = checkoutReturnKey(checkoutReturn, window.location.pathname);
		const replaceCheckoutReturn = () => {
			const currentReturn = domainCheckoutReturnFromSearch(
				window.location.search,
			);

			if (
				!currentReturn ||
				checkoutReturnKey(currentReturn, window.location.pathname) !== key
			) {
				return;
			}

			const nextSearch = withoutCheckoutReturnParams(window.location.search);
			router.history.replace(
				`${window.location.pathname}${nextSearch}${window.location.hash}`,
				router.history.location.state,
			);
		};

		if (checkoutReturn.kind === "cancel") {
			if (!handledCheckoutCancellations.has(key)) {
				handledCheckoutCancellations.add(key);
				toast(CANCELED_TOAST, {
					id: `domain-checkout-${key}`,
					position: "bottom-right",
				});
			}

			replaceCheckoutReturn();
			return;
		}

		let reconciliation = checkoutReconciliations.get(key);

		if (!reconciliation) {
			const refreshDomains = () =>
				queryClient.invalidateQueries({
					queryKey: domainKeys.list(projectId),
					refetchType: "active",
				});

			reconciliation = reconcileSessionIntoCache(queryClient, {
				sessionId: checkoutReturn.sessionId,
			})
				.then(
					() => {
						toast.success(PURCHASED_TOAST, {
							id: `domain-checkout-${key}`,
							position: "bottom-right",
						});
						return refreshDomains();
					},
					() => {
						// A webhook may have completed the order even if this request lost
						// its response, so refresh the project list before giving up.
						return refreshDomains();
					},
				)
				.catch(() => undefined);
			checkoutReconciliations.set(key, reconciliation);
		}

		// Every mount can await the one shared task. This keeps reconciliation and
		// its toast single-shot while still cleaning up after a Strict Mode remount.
		void reconciliation.then(replaceCheckoutReturn);
	}, [projectId, queryClient, router, search]);
}
