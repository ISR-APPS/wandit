import {
	type QueryClient,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";

import { organizationKeys } from "@/features/organizations/api/organizations.queries";
import { userKeys } from "@/features/users/api/users.queries";

import type {
	AdminGrantManualSubscriptionInput,
	AdminManualSubscriptionDetail,
	EndManualSubscriptionInput,
	RenewManualSubscriptionInput,
	UpdateManualRequestInput,
} from "./offline-billing.dto";
import { offlineBillingKeys } from "./offline-billing.queries";
import {
	endManualSubscription,
	grantManualSubscription,
	renewManualSubscription,
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

export function useGrantManualSubscriptionMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: AdminGrantManualSubscriptionInput) =>
			grantManualSubscription(input),
		onSuccess: (detail) => {
			syncManualSubscriptionQueries(queryClient, detail.id, detail);
		},
	});
}

export function useRenewManualSubscriptionMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: RenewManualSubscriptionInput) =>
			renewManualSubscription(input),
		onSuccess: (detail) => {
			syncManualSubscriptionQueries(queryClient, detail.id, detail);
		},
	});
}

export function useEndManualSubscriptionMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: EndManualSubscriptionInput) =>
			endManualSubscription(input),
		onSuccess: (detail) => {
			syncManualSubscriptionQueries(queryClient, detail.id, detail);
		},
	});
}

function syncManualSubscriptionQueries(
	queryClient: QueryClient,
	subscriptionId: string,
	detail: AdminManualSubscriptionDetail,
) {
	queryClient.setQueryData(
		offlineBillingKeys.subscriptionDetail(subscriptionId),
		detail,
	);
	void queryClient.invalidateQueries({
		queryKey: offlineBillingKeys.subscriptionLists(),
	});
	void queryClient.invalidateQueries({
		queryKey: offlineBillingKeys.requests(),
	});
	void queryClient.invalidateQueries({
		queryKey: offlineBillingKeys.stats(),
	});

	if (detail.organization) {
		void queryClient.invalidateQueries({
			queryKey: organizationKeys.detail(detail.organization.id),
		});
		void queryClient.invalidateQueries({
			queryKey: organizationKeys.lists(),
		});
		return;
	}

	void queryClient.invalidateQueries({
		queryKey: userKeys.detail(detail.user.id),
	});
	void queryClient.invalidateQueries({ queryKey: userKeys.lists() });
}
