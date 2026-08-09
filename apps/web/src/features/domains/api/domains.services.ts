// Raw custom-domain API functions. These are thin wrappers over ApiService,
// with every response parsed by @wandit/contracts before reaching React.

import {
	attachExternalDomainResponseSchema,
	detachDomainResponseSchema,
	domainsRoutes,
	isSupportedTld,
	listDomainsResponseSchema,
	searchDomainsResponseSchema,
	setPrimaryDomainResponseSchema,
	transferUnlockDomainResponseSchema,
	updateDomainAutoRenewResponseSchema,
	verifyDomainResponseSchema,
} from "@wandit/contracts";

import { ApiService, isApiClientError } from "@/lib/api-client";
import type {
	AttachExternalDomainBody,
	AttachExternalDomainResponse,
	DetachDomainResponse,
	Domain,
	SearchDomainsResponse,
	SetPrimaryDomainResponse,
	TransferUnlockDomainResponse,
	UpdateDomainAutoRenewBody,
	UpdateDomainAutoRenewResponse,
	VerifyDomainResponse,
} from "./domains.dto";

export async function searchDomains(q: string): Promise<SearchDomainsResponse> {
	try {
		const payload = await ApiService.get<SearchDomainsResponse>(
			domainsRoutes.search,
			{
				query: { q },
				skipAuthRedirect: true,
			},
		);

		return searchDomainsResponseSchema.parse(payload);
	} catch (error) {
		if (isReadEndpointPendingError(error)) {
			return { results: [] };
		}

		throw error;
	}
}

export async function listProjectDomains(projectId: string): Promise<Domain[]> {
	try {
		const payload = await ApiService.get<{ domains: Domain[] }>(
			domainsRoutes.listByProject(projectId),
			{ skipAuthRedirect: true },
		);

		return listDomainsResponseSchema.parse(payload).domains;
	} catch (error) {
		if (isReadEndpointPendingError(error)) {
			return [];
		}

		throw error;
	}
}

export async function attachExternalDomain(
	projectId: string,
	body: AttachExternalDomainBody,
): Promise<AttachExternalDomainResponse> {
	const payload = await ApiService.post<
		AttachExternalDomainResponse,
		AttachExternalDomainBody
	>(domainsRoutes.external(projectId), body);

	return attachExternalDomainResponseSchema.parse(payload);
}

export async function verifyDomain(
	domainId: string,
): Promise<VerifyDomainResponse> {
	const payload = await ApiService.post<VerifyDomainResponse>(
		domainsRoutes.verify(domainId),
	);

	return verifyDomainResponseSchema.parse(payload);
}

export async function updateDomainAutoRenew(
	domainId: string,
	body: UpdateDomainAutoRenewBody,
): Promise<UpdateDomainAutoRenewResponse> {
	const payload = await ApiService.post<
		UpdateDomainAutoRenewResponse,
		UpdateDomainAutoRenewBody
	>(domainsRoutes.autoRenew(domainId), body);

	return updateDomainAutoRenewResponseSchema.parse(payload);
}

export async function setPrimaryDomain(
	domainId: string,
): Promise<SetPrimaryDomainResponse> {
	const payload = await ApiService.post<SetPrimaryDomainResponse>(
		domainsRoutes.primary(domainId),
	);

	return setPrimaryDomainResponseSchema.parse(payload);
}

export async function transferUnlockDomain(
	domainId: string,
): Promise<TransferUnlockDomainResponse> {
	const payload = await ApiService.post<TransferUnlockDomainResponse>(
		domainsRoutes.transferUnlock(domainId),
	);

	return transferUnlockDomainResponseSchema.parse(payload);
}

export async function detachDomain(
	domainId: string,
): Promise<DetachDomainResponse> {
	const payload = await ApiService.delete<DetachDomainResponse>(
		domainsRoutes.detach(domainId),
	);

	return detachDomainResponseSchema.parse(payload);
}

function isReadEndpointPendingError(error: unknown) {
	if (!isApiClientError(error)) {
		return false;
	}

	// 401 deliberately propagates: an expired session must surface as an auth
	// error, not render as "No domains found".
	return (
		error.statusCode === 404 ||
		error.statusCode === 501 ||
		error.code === "NOT_FOUND" ||
		error.code === "HTTP_404" ||
		error.code === "HTTP_501"
	);
}

export function isSupportedDomainTld(tld: string) {
	return isSupportedTld(tld);
}
