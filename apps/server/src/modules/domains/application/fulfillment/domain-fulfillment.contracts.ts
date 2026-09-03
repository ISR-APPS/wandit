import type {
	DomainDns,
	DomainStatus,
	PaymentOrderStatus,
	RequiredDomainRecord,
} from "@wandit/contracts";

export const DOMAIN_CONFIGURATION_MAX_ATTEMPT = 100;
export const DOMAIN_CONFIGURATION_INITIAL_DELAY_SECONDS = 30;
export const DOMAIN_CONFIGURATION_MAX_DELAY_SECONDS = 15 * 60;

const DOMAIN_PURCHASE_NONCE_PREFIX = "purchase:";

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONFIGURATION_NONCE_MAX_LENGTH = 255;

export type DomainPurchasePayload = {
	domainId: string;
	orderId: string;
};

export type DomainConfigurationPayload = {
	domainId: string;
	nonce: string;
};

export type CustomHostnameRecord = {
	name: string;
	type: "TXT";
	value: string;
};

export type CustomHostnameResult = {
	hostnameStatus: string | null;
	id: string;
	requiredRecords: CustomHostnameRecord[];
	sslStatus: string | null;
	status: string;
};

/**
 * A Cloudflare zone in our account that hosts one domain's DNS (purchased:
 * the registrar delegates to it; external: the user may delegate to it).
 */
export type CustomerZone = {
	id: string;
	nameServers: string[];
	status: string;
};

export type CustomerZoneDnsRecord = {
	content: string;
	name: string;
	proxied?: boolean;
	ttl?: number;
	type: "CNAME" | "TXT";
};

/** Result of Cloudflare's one-shot import of a domain's public DNS records. */
export type CustomerZoneDnsScan = {
	recordsAdded: number;
	recordsParsed: number;
};

/**
 * Selects the address records at one exact name that must make room for our
 * traffic CNAME: every A/AAAA record and any CNAME whose content differs from
 * `keepContent` (the fallback origin).
 */
export type CustomerZoneDnsRecordDeletion = {
	keepContent?: string;
	name: string;
	types: readonly ("A" | "AAAA" | "CNAME")[];
};

export type DomainConfigurationCursor = {
	nextAttempt: number;
	nextProbeAt: Date | null;
	nonce: string;
};

export type PersistedDomainConfigurationCursor = {
	nextAttempt: number;
	nextProbeAt: string | null;
	nonce: string;
};

export type DomainFulfillmentDns = DomainDns & {
	customHostnameDnsConfigured?: boolean;
	purchaseDnsConfigured?: boolean;
	triggerConfiguration?: PersistedDomainConfigurationCursor;
};

/**
 * The `dns` keys ApexZoneStep owns. It is persisted as a shallow merge into
 * the stored `dns` object (never a full replace), so a live verification cursor
 * in `dns.triggerConfiguration` is left alone. A `null` value removes the key
 * (used to withdraw a zone that no longer exists).
 */
export type DomainApexDnsPatch = {
	apexConfigured?: true | null;
	apexCustomHostnameId?: string;
	apexCustomHostnameNudged?: true | null;
	apexCustomHostnameStatus?: string;
	apexError?: string | null;
	records?: RequiredDomainRecord[];
	zoneActive?: true | null;
	zoneCreated?: true | null;
	zoneDelegated?: true | null;
	zoneId?: string | null;
	zoneNameServers?: string[] | null;
	zoneNameserversExposedAt?: string | null;
	zoneScanned?: true | null;
	zoneScanRecordsAdded?: number | null;
	zoneStatus?: string | null;
};

export type DomainFulfillmentRow = {
	cfCustomHostnameId: string | null;
	dns: unknown;
	error: string | null;
	expiresAt: Date | null;
	id: string;
	isPrimary: boolean;
	name: string;
	paymentOrderId: string | null;
	projectId: string | null;
	provider: string | null;
	providerDomainId: string | null;
	providerOrderId: string | null;
	providerTotalPaidUsd: string | null;
	registrant: unknown;
	source: "external" | "purchased";
	status: DomainStatus;
	transferLockExpiresAt: Date | null;
	updatedAt: Date;
	whoisPrivacy: boolean;
};

export type DomainFulfillmentPatch = Partial<
	Pick<
		DomainFulfillmentRow,
		| "cfCustomHostnameId"
		| "dns"
		| "error"
		| "expiresAt"
		| "isPrimary"
		| "providerDomainId"
		| "providerOrderId"
		| "providerTotalPaidUsd"
		| "status"
		| "transferLockExpiresAt"
	>
>;

export type DomainFulfillmentOrder = {
	fulfillmentError: string | null;
	id: string;
	refundStatus: string | null;
	status: PaymentOrderStatus;
};

export type DomainFulfillmentLogger = {
	error(message: string, details?: unknown): void;
	warn(message: string, details?: unknown): void;
};

export type DurableWait = {
	until(input: { date: Date }): Promise<void>;
};

export type DomainConfigurationRunResult =
	| {
			processed: false;
			reason:
				| "detached"
				| "external_still_pending"
				| "missing_cf_hostname"
				| "not_configuring"
				| "state_changed"
				| "timed_out";
			terminalized: boolean;
	  }
	| { processed: true; status: "active"; terminalized: false };

export function buildDomainPurchaseNonce(orderId: string): string {
	return `${DOMAIN_PURCHASE_NONCE_PREFIX}${orderId}`;
}

export function parseDomainPurchasePayload(
	value: unknown,
): DomainPurchasePayload {
	const input = strictObject(value, ["domainId", "orderId"], "Domain purchase");

	assertUuid(input.domainId, "domainId");
	assertUuid(input.orderId, "orderId");

	return { domainId: input.domainId, orderId: input.orderId };
}

export function parseDomainConfigurationPayload(
	value: unknown,
): DomainConfigurationPayload {
	const input = strictObject(
		value,
		["domainId", "nonce"],
		"Domain configuration",
	);

	assertUuid(input.domainId, "domainId");

	if (
		typeof input.nonce !== "string" ||
		input.nonce.length === 0 ||
		input.nonce.length > CONFIGURATION_NONCE_MAX_LENGTH ||
		input.nonce.trim() !== input.nonce
	) {
		throw new TypeError("nonce must be a non-empty bounded string");
	}

	return { domainId: input.domainId, nonce: input.nonce };
}

export function parseDomainConfigurationCursor(
	value: unknown,
): DomainConfigurationCursor {
	const input = strictObject(
		value,
		["nextAttempt", "nextProbeAt", "nonce"],
		"Domain configuration cursor",
	);

	if (
		typeof input.nextAttempt !== "number" ||
		!Number.isInteger(input.nextAttempt) ||
		input.nextAttempt < 0 ||
		input.nextAttempt > DOMAIN_CONFIGURATION_MAX_ATTEMPT
	) {
		throw new TypeError("nextAttempt must be an integer from 0 through 100");
	}

	if (
		typeof input.nonce !== "string" ||
		input.nonce.length === 0 ||
		input.nonce.length > CONFIGURATION_NONCE_MAX_LENGTH
	) {
		throw new TypeError("cursor nonce must be a non-empty bounded string");
	}

	let nextProbeAt: Date | null = null;

	if (input.nextProbeAt !== null) {
		if (typeof input.nextProbeAt !== "string") {
			throw new TypeError("nextProbeAt must be an ISO date string or null");
		}

		nextProbeAt = new Date(input.nextProbeAt);

		if (
			Number.isNaN(nextProbeAt.getTime()) ||
			nextProbeAt.toISOString() !== input.nextProbeAt
		) {
			throw new TypeError("nextProbeAt must be an ISO date string or null");
		}
	}

	return {
		nextAttempt: input.nextAttempt,
		nextProbeAt,
		nonce: input.nonce,
	};
}

export function persistDomainConfigurationCursor(
	cursor: DomainConfigurationCursor,
): PersistedDomainConfigurationCursor {
	return {
		nextAttempt: cursor.nextAttempt,
		nextProbeAt: cursor.nextProbeAt?.toISOString() ?? null,
		nonce: cursor.nonce,
	};
}

function strictObject(
	value: unknown,
	keys: string[],
	label: string,
): Record<string, unknown> {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		throw new TypeError(`${label} payload must be an object`);
	}

	const input = value as Record<string, unknown>;
	const actualKeys = Object.keys(input).sort();
	const expectedKeys = [...keys].sort();

	if (
		actualKeys.length !== expectedKeys.length ||
		actualKeys.some((key, index) => key !== expectedKeys[index])
	) {
		throw new TypeError(
			`${label} payload must contain only ${expectedKeys.join(", ")}`,
		);
	}

	return input;
}

function assertUuid(value: unknown, name: string): asserts value is string {
	if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
		throw new TypeError(`${name} must be a UUID`);
	}
}
