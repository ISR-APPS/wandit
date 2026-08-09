import {
	type QueryClient,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";

import type {
	GrantOrganizationCreditsInput,
	OrganizationDetail,
	SetOrganizationMemberRoleInput,
} from "./organizations.dto";
import { organizationKeys } from "./organizations.queries";
import {
	grantOrganizationCredits,
	setOrganizationMemberRole,
} from "./organizations.services";

export function useGrantOrganizationCreditsMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: GrantOrganizationCreditsInput) =>
			grantOrganizationCredits(input),
		onSuccess: (detail) => syncOrganizationQueries(queryClient, detail),
	});
}

export function useSetOrganizationMemberRoleMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: SetOrganizationMemberRoleInput) =>
			setOrganizationMemberRole(input),
		onSuccess: (detail) => syncOrganizationQueries(queryClient, detail),
	});
}

function syncOrganizationQueries(
	queryClient: QueryClient,
	detail: OrganizationDetail,
) {
	queryClient.setQueryData(organizationKeys.detail(detail.id), detail);
	void queryClient.invalidateQueries({ queryKey: organizationKeys.lists() });
}
