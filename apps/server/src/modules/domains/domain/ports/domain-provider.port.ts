import type { Registrant } from "@wandit/contracts";

export const DOMAIN_PROVIDER = Symbol("DOMAIN_PROVIDER");

export type DomainAvailability = {
	available: boolean;
	name: string;
	premium?: boolean;
	renewalPriceUsd?: number;
	wholesalePriceUsd?: number;
};

export type DomainDnsRecord = {
	name: string;
	type: "A" | "AAAA" | "CNAME" | "NS" | "TXT";
	value: string;
};

export type DomainRegistrationResult = {
	expiresAt: Date | null;
	providerDomainId: string;
	// Registrar receipt data is kept for support and cost reconciliation.
	providerOrderId?: string;
	totalPaidUsd?: number;
	transferLockExpiresAt?: Date | null;
};

export type DomainProviderInfo = {
	expiresAt: Date | null;
	id: string;
	isLocked?: boolean;
	status?: string;
	transferLockExpiresAt?: Date | null;
};

export type DomainRegistrationOptions = {
	// Name.com replays the original result when this key is reused. The registration
	// task derives it from our durable domain id so retries cannot buy twice.
	idempotencyKey: string;
	privacy: boolean;
	years: number;
};

export interface DomainProvider {
	checkAvailability(names: string[]): Promise<DomainAvailability[]>;
	register(
		name: string,
		registrant: Registrant,
		options: DomainRegistrationOptions,
	): Promise<DomainRegistrationResult>;
	renew(name: string, years: number): Promise<{ expiresAt: Date | null }>;
	setDnsRecords(name: string, records: DomainDnsRecord[]): Promise<void>;
	setNameservers(name: string, nameservers: string[]): Promise<void>;
	setUrlForwarding(name: string, target: string): Promise<void>;
	getAuthCode(name: string): Promise<string>;
	setTransferLock(name: string, locked: boolean): Promise<void>;
	getDomainInfo(name: string): Promise<DomainProviderInfo | null>;
}
