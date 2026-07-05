// TanStack Query mutations for custom domains. Every successful lifecycle
// action refreshes the project domain list so Settings stays current.

import { useMutation, useQueryClient } from "@tanstack/react-query";

import type {
	AttachExternalDomainBody,
	PurchaseDomainBody,
	UpdateDomainAutoRenewBody,
} from "./domains.dto";
import { domainKeys } from "./domains.queries";
import {
	attachExternalDomain,
	detachDomain,
	purchaseDomain,
	renewDomain,
	setPrimaryDomain,
	transferUnlockDomain,
	updateDomainAutoRenew,
	verifyDomain,
} from "./domains.services";

export function usePurchaseDomain(projectId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (body: PurchaseDomainBody) => purchaseDomain(projectId, body),
		onSuccess: ({ domain }) => {
			queryClient.setQueryData(domainKeys.list(projectId), (old) =>
				Array.isArray(old) ? upsertDomain(old, domain) : [domain],
			);
			void queryClient.invalidateQueries({ queryKey: domainKeys.list(projectId) });
		},
	});
}

export function useAttachExternalDomain(projectId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (body: AttachExternalDomainBody) =>
			attachExternalDomain(projectId, body),
		onSuccess: ({ domain }) => {
			queryClient.setQueryData(domainKeys.list(projectId), (old) =>
				Array.isArray(old) ? upsertDomain(old, domain) : [domain],
			);
			void queryClient.invalidateQueries({ queryKey: domainKeys.list(projectId) });
		},
	});
}

export function useVerifyDomain(projectId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (domainId: string) => verifyDomain(domainId),
		onSuccess: ({ domain }) => {
			queryClient.setQueryData(domainKeys.list(projectId), (old) =>
				Array.isArray(old) ? upsertDomain(old, domain) : [domain],
			);
			void queryClient.invalidateQueries({ queryKey: domainKeys.list(projectId) });
		},
	});
}

export function useRenewDomain(projectId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (domainId: string) => renewDomain(domainId),
		onSuccess: ({ domain }) => {
			queryClient.setQueryData(domainKeys.list(projectId), (old) =>
				Array.isArray(old) ? upsertDomain(old, domain) : [domain],
			);
			void queryClient.invalidateQueries({ queryKey: domainKeys.list(projectId) });
		},
	});
}

export function useUpdateDomainAutoRenew(projectId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			domainId,
			autoRenew,
		}: { domainId: string; autoRenew: boolean }) =>
			updateDomainAutoRenew(domainId, { autoRenew } satisfies UpdateDomainAutoRenewBody),
		onSuccess: ({ domain }) => {
			queryClient.setQueryData(domainKeys.list(projectId), (old) =>
				Array.isArray(old) ? upsertDomain(old, domain) : [domain],
			);
			void queryClient.invalidateQueries({ queryKey: domainKeys.list(projectId) });
		},
	});
}

export function useSetPrimaryDomain(projectId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (domainId: string) => setPrimaryDomain(domainId),
		onSuccess: ({ domain }) => {
			queryClient.setQueryData(domainKeys.list(projectId), (old) =>
				Array.isArray(old)
					? old.map((item) => ({
							...item,
							isPrimary: item.id === domain.id,
						}))
					: [domain],
			);
			void queryClient.invalidateQueries({ queryKey: domainKeys.list(projectId) });
		},
	});
}

export function useTransferUnlockDomain() {
	return useMutation({
		mutationFn: (domainId: string) => transferUnlockDomain(domainId),
	});
}

export function useDetachDomain(projectId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (domainId: string) => detachDomain(domainId),
		onSuccess: ({ domain }) => {
			queryClient.setQueryData(domainKeys.list(projectId), (old) =>
				Array.isArray(old)
					? old.filter((item) => item.id !== domain.id)
					: [],
			);
			void queryClient.invalidateQueries({ queryKey: domainKeys.list(projectId) });
		},
	});
}

function upsertDomain<TDomain extends { id: string }>(
	domains: TDomain[],
	domain: TDomain,
) {
	const exists = domains.some((item) => item.id === domain.id);

	if (!exists) {
		return [domain, ...domains];
	}

	return domains.map((item) => (item.id === domain.id ? domain : item));
}
