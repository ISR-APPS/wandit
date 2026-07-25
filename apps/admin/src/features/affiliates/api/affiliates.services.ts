import {
	createMockAffiliate,
	createMockAffiliateCode,
	getMockAffiliate,
	listMockAffiliates,
	setMockAffiliateCodeStatus,
	setMockAffiliateStatus,
} from "../lib/mock-affiliates";
import type {
	Affiliate,
	CreateAffiliateCodeInput,
	CreateAffiliateInput,
	SetAffiliateCodeStatusInput,
	SetAffiliateStatusInput,
} from "./affiliates.dto";

const MOCK_LATENCY_MS = 180;

export async function listAffiliates(): Promise<Affiliate[]> {
	await mockLatency();
	return listMockAffiliates();
}

export async function getAffiliate(affiliateId: string): Promise<Affiliate> {
	await mockLatency();
	return getMockAffiliate(affiliateId);
}

export async function createAffiliate(
	input: CreateAffiliateInput,
): Promise<Affiliate> {
	await mockLatency();
	return createMockAffiliate(input);
}

export async function createAffiliateCode({
	affiliateId,
	...code
}: CreateAffiliateCodeInput): Promise<Affiliate> {
	await mockLatency();
	return createMockAffiliateCode(affiliateId, code);
}

export async function setAffiliateStatus(
	input: SetAffiliateStatusInput,
): Promise<Affiliate> {
	await mockLatency();
	return setMockAffiliateStatus(input);
}

export async function setAffiliateCodeStatus(
	input: SetAffiliateCodeStatusInput,
): Promise<Affiliate> {
	await mockLatency();
	return setMockAffiliateCodeStatus(input);
}

function mockLatency() {
	return new Promise<void>((resolve) => {
		globalThis.setTimeout(resolve, MOCK_LATENCY_MS);
	});
}
