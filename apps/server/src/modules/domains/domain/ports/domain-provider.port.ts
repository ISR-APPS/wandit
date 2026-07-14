import type { Registrant } from "@wandit/contracts";

export const DOMAIN_PROVIDER = Symbol("DOMAIN_PROVIDER");

export type DomainAvailability = {
	available: boolean;
	name: string;
	premium?: boolean;
	wholesalePriceUsd?: number;
};

export type DomainDnsRecord = {
	name: string;
	type: "A" | "AAAA" | "CNAME" | "TXT";
	value: string;
};

export type DomainRegistrationResult = {
	expiresAt: Date | null;
	providerDomainId: string;
};

export type DomainProviderInfo = {
	expiresAt: Date | null;
	id: string;
	isLocked?: boolean;
	status?: string;
};

export interface DomainProvider {
	checkAvailability(names: string[]): Promise<DomainAvailability[]>;
	register(
		name: string,
		registrant: Registrant,
		options: { privacy: boolean; years: number },
	): Promise<DomainRegistrationResult>;
	renew(name: string, years: number): Promise<{ expiresAt: Date | null }>;
	setDnsRecords(name: string, records: DomainDnsRecord[]): Promise<void>;
	setUrlForwarding(name: string, target: string): Promise<void>;
	getAuthCode(name: string): Promise<string>;
	setTransferLock(name: string, locked: boolean): Promise<void>;
	getDomainInfo(name: string): Promise<DomainProviderInfo | null>;
}
