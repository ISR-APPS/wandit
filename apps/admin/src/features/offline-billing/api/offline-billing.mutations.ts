/**
 * React Query mutations of the offline billing feature: request updates, "Record top-up", "Reverse top-up".
 * Called by the offline billing components. Calls offline-billing.services and refreshes the owner pages.
 */
import {
	type QueryClient,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";

import { organizationKeys } from "@/features/organizations/api/organizations.queries";
import { userKeys } from "@/features/users/api/users.queries";

import type {
	AdminRecordTopupInput,
	AdminTopupReceipt,
	UpdateManualRequestInput,
} from "./offline-billing.dto";
import { offlineBillingKeys } from "./offline-billing.queries";
import {
	recordTopup,
	reverseTopup,
	updateManualRequest,
} from "./offline-billing.services";

export function useUpdateManualRequestMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: UpdateManualRequestInput) => updateManualRequest(input),
		onSuccess: (request) => {
			queryClient.setQueryData(
				offlineBillingKeys.requestDetail(request.id),
				request,
			);
			void queryClient.invalidateQueries({
				queryKey: offlineBillingKeys.requestLists(),
			});
			void queryClient.invalidateQueries({
				queryKey: offlineBillingKeys.stats(),
			});
		},
	});
}

/** "Record top-up". The caller keeps the idempotency key for a retry of the same form. */
export function useRecordTopupMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: AdminRecordTopupInput) => recordTopup(input),
		onSuccess: (receipt) => syncTopupReceiptQueries(queryClient, receipt),
	});
}

/** "Reverse top-up" of one SlickPay or offline receipt. */
export function useReverseTopupMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (receiptId: string) => reverseTopup(receiptId),
		onSuccess: (receipt) => syncTopupReceiptQueries(queryClient, receipt),
	});
}

// A receipt changes the wallet balance of its owner and can approve a request.
function syncTopupReceiptQueries(
	queryClient: QueryClient,
	receipt: AdminTopupReceipt,
) {
	void queryClient.invalidateQueries({
		queryKey: offlineBillingKeys.topupReceiptLists(),
	});
	void queryClient.invalidateQueries({
		queryKey: offlineBillingKeys.requests(),
	});
	void queryClient.invalidateQueries({
		queryKey: offlineBillingKeys.stats(),
	});

	if (receipt.organization) {
		void queryClient.invalidateQueries({
			queryKey: organizationKeys.detail(receipt.organization.id),
		});
		void queryClient.invalidateQueries({
			queryKey: organizationKeys.lists(),
		});
		return;
	}

	void queryClient.invalidateQueries({
		queryKey: userKeys.detail(receipt.user.id),
	});
	void queryClient.invalidateQueries({ queryKey: userKeys.lists() });
}
