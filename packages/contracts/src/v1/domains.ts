import { z } from "zod";
import { isoDateTimeSchema, uuidSchema } from "./shared/primitives";

export const domainSources = ["purchased", "external"] as const;

export const domainSourceSchema = z.enum(domainSources);

export type DomainSource = z.infer<typeof domainSourceSchema>;

export const domainStatuses = [
	"registering",
	"configuring",
	"active",
	"failed",
	"expired",
	"transferred_out",
] as const;

export const domainStatusSchema = z.enum(domainStatuses);

export type DomainStatus = z.infer<typeof domainStatusSchema>;

export const domainTlds = [
	"com",
	"net",
	"shop",
	"store",
	"online",
	"site",
] as const;

export const domainTldSchema = z.enum(domainTlds);

export type DomainTld = z.infer<typeof domainTldSchema>;

export type DomainTldCatalogItem = {
	wholesaleCeilingUsd: number;
};

/*
 * Fail-closed guards around the registrar's wholesale registration quote.
 *
 * Every ceiling is a standalone per-TLD cap on acceptable wholesale quotes.
 * A purchase whose wholesale quote exceeds the ceiling is blocked. The UI never
 * displays these cap values.
 */
export const DOMAIN_TLD_CATALOG = {
	com: {
		wholesaleCeilingUsd: 24,
	},
	net: {
		wholesaleCeilingUsd: 28,
	},
	shop: {
		wholesaleCeilingUsd: 36,
	},
	store: {
		wholesaleCeilingUsd: 36,
	},
	online: {
		wholesaleCeilingUsd: 32,
	},
	site: {
		wholesaleCeilingUsd: 30,
	},
} as const satisfies Record<DomainTld, DomainTldCatalogItem>;

// Retail is the live registrar wholesale quote plus this margin.
export const DOMAIN_RETAIL_MARGIN_USD_CENTS = 200;

export function domainRetailUsdCentsFromWholesale(
	wholesaleUsd: number,
): number {
	return Math.round(wholesaleUsd * 100) + DOMAIN_RETAIL_MARGIN_USD_CENTS;
}

// Name.com requires a real E.164 number: "+" plus 8–15 digits.
const e164PhoneRegex = /^\+[1-9]\d{7,14}$/;
const domainLabelRegex = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const reservedRegistrableDomains = ["wandit.app", "wandit.dev"] as const;
const reservedSecondLevelDomains = ["wandit-preview"] as const;

export type ParsedDomainName = {
	name: string;
	sld: string;
	tld: DomainTld;
};

export type ParsedExternalDomainName = {
	name: string;
	sld: string;
	tld: string;
};

function normalizeDomainNameInput(name: string) {
	return name.trim().toLowerCase();
}

function normalizeTldInput(tld: string) {
	return tld.trim().toLowerCase().replace(/^\./, "");
}

function asSupportedTld(tld: string): DomainTld | null {
	const normalizedTld = normalizeTldInput(tld);

	return (domainTlds as readonly string[]).includes(normalizedTld)
		? (normalizedTld as DomainTld)
		: null;
}

export function isSupportedTld(tld: string) {
	return asSupportedTld(tld) !== null;
}

export function catalogFor(tld: string): DomainTldCatalogItem | null {
	const supportedTld = asSupportedTld(tld);

	return supportedTld ? DOMAIN_TLD_CATALOG[supportedTld] : null;
}

export function isValidDomainLabel(label: string) {
	return label.length <= 63 && domainLabelRegex.test(label);
}

export function isReservedDomainName(name: string) {
	const normalizedName = normalizeDomainNameInput(name);
	const labels = normalizedName.split(".");
	const sld = labels[0];

	return (
		reservedRegistrableDomains.some(
			(domain) =>
				normalizedName === domain || normalizedName.endsWith(`.${domain}`),
		) ||
		(sld !== undefined &&
			(reservedSecondLevelDomains as readonly string[]).includes(sld))
	);
}

export function parseDomainName(name: string): ParsedDomainName | null {
	const normalizedName = normalizeDomainNameInput(name);

	if (
		normalizedName.length === 0 ||
		normalizedName.length > 253 ||
		isReservedDomainName(normalizedName)
	) {
		return null;
	}

	const labels = normalizedName.split(".");

	if (labels.length !== 2) {
		return null;
	}

	const [sld, tldValue] = labels;

	if (
		!sld ||
		!tldValue ||
		!isValidDomainLabel(sld) ||
		!isValidDomainLabel(tldValue)
	) {
		return null;
	}

	const tld = asSupportedTld(tldValue);

	if (!tld) {
		return null;
	}

	return {
		name: `${sld}.${tld}`,
		sld,
		tld,
	};
}

export function parseExternalDomainName(
	name: string,
): ParsedExternalDomainName | null {
	const normalizedName = normalizeDomainNameInput(name);

	if (
		normalizedName.length === 0 ||
		normalizedName.length > 253 ||
		isReservedDomainName(normalizedName)
	) {
		return null;
	}

	const labels = normalizedName.split(".");

	if (labels.length !== 2) {
		return null;
	}

	const [sld, tld] = labels;

	if (!sld || !tld || !isValidDomainLabel(sld) || !isValidDomainLabel(tld)) {
		return null;
	}

	return {
		name: `${sld}.${tld}`,
		sld,
		tld,
	};
}

const sanitizedDomainInputSchema = z
	.string()
	.transform(normalizeDomainNameInput);

export const domainNameSchema = sanitizedDomainInputSchema.pipe(
	z.string().refine((name) => parseDomainName(name) !== null, {
		message: "Domain name must be an unreserved, supported sld.tld name",
	}),
);

export const externalDomainNameSchema = sanitizedDomainInputSchema.pipe(
	z.string().refine((name) => parseExternalDomainName(name) !== null, {
		message: "Domain name must be an unreserved sld.tld name",
	}),
);

export const publicDomainNameSchema = sanitizedDomainInputSchema.pipe(
	z.string().refine((name) => parseExternalDomainName(name) !== null, {
		message: "Domain name must be an unreserved sld.tld name",
	}),
);

export const publicDomainTldSchema = z
	.string()
	.trim()
	.toLowerCase()
	.refine(isValidDomainLabel, {
		message: "Domain TLD must be a valid lowercase label",
	});

export const registrantSchema = z.object({
	firstName: z.string().trim().min(1).max(100),
	lastName: z.string().trim().min(1).max(100),
	email: z.email(),
	phone: z.string().regex(e164PhoneRegex, "Phone must be E.164"),
	address: z.object({
		street: z.string().trim().min(1).max(200),
		city: z.string().trim().min(1).max(100),
		wilaya: z.string().trim().min(1).max(100),
		zip: z.string().trim().min(1).max(20),
		countryCode: z
			.string()
			.trim()
			.toUpperCase()
			.regex(/^[A-Z]{2}$/, "Country code must be ISO-3166-1 alpha-2")
			.default("DZ"),
	}),
	companyName: z.string().trim().min(1).max(200).optional(),
});

export type Registrant = z.infer<typeof registrantSchema>;

/*
 * Pricing facts frozen onto a payment order at checkout time, so fulfillment
 * and refunds reason about what was actually charged even if the catalog or
 * registrar quote changes later. Server-side only — never sent to clients.
 */
export const domainPriceSnapshotSchema = z.object({
	tld: domainTldSchema,
	wholesaleCeilingUsd: z.number().positive(),
	chargedAmountCents: z.int().positive(),
	chargedCurrency: z.string().length(3),
	// The registrar's wholesale quote at checkout time; null when the order
	// predates quote capture. The worker re-quotes before registering anyway.
	quotedWholesaleUsd: z.number().positive().nullable(),
});

export type DomainPriceSnapshot = z.infer<typeof domainPriceSnapshotSchema>;

export const requiredDomainRecordSchema = z.object({
	type: z.enum(["A", "AAAA", "CNAME", "NS", "TXT"]),
	name: z.string().min(1),
	value: z.string().min(1),
	purpose: z.string().min(1),
});

export type RequiredDomainRecord = z.infer<typeof requiredDomainRecordSchema>;

export const domainDnsSchema = z
	.object({
		// Apex state for purchased AND external domains (server-side only;
		// mapDomain never exposes it): the Cloudflare zone in our account that
		// hosts (or is offered to host) the domain's DNS, the bare-name custom
		// hostname, the durable "apex done" marker, and the last apex error.
		apexConfigured: z.boolean().optional(),
		apexCustomHostnameId: z.string().optional(),
		apexCustomHostnameNudged: z.boolean().optional(),
		apexCustomHostnameStatus: z.string().optional(),
		apexError: z.string().optional(),
		externalVerification: z
			.object({
				attempts: z.int().nonnegative(),
				stalledAt: isoDateTimeSchema,
			})
			.optional(),
		records: z.array(requiredDomainRecordSchema).optional(),
		zoneActive: z.boolean().optional(),
		// True only when the pipeline created the zone itself (an adopted
		// zone is never deleted by cleanup).
		zoneCreated: z.boolean().optional(),
		// Purchased: written right BEFORE the registrar nameserver call.
		// External: written as soon as the zone's nameservers were exposed to
		// the user, who may delegate at any time. Either way the registry may
		// delegate to the zone from then on, so cleanup never deletes it.
		zoneDelegated: z.boolean().optional(),
		zoneId: z.string().optional(),
		zoneNameServers: z.array(z.string()).optional(),
		// External only: when the zone nameservers first became actionable in
		// the setup UI. Delegation reminders age from this point.
		zoneNameserversExposedAt: isoDateTimeSchema.optional(),
		// External only: the one-time import of the domain's current public
		// DNS into the zone (Cloudflare record scan) already ran; it must never
		// run again once the user may have switched nameservers to us.
		zoneScanned: z.boolean().optional(),
		zoneScanRecordsAdded: z.int().nonnegative().optional(),
		zoneStatus: z.string().optional(),
	})
	.passthrough();

export type DomainDns = z.infer<typeof domainDnsSchema>;

export const domainSchema = z.object({
	id: uuidSchema,
	userId: z.string(),
	projectId: uuidSchema.nullable(),
	name: publicDomainNameSchema,
	tld: publicDomainTldSchema,
	source: domainSourceSchema,
	status: domainStatusSchema,
	isPrimary: z.boolean(),
	registrant: registrantSchema.nullable(),
	whoisPrivacy: z.boolean(),
	autoRenew: z.boolean(),
	expiresAt: isoDateTimeSchema.nullable(),
	// `openprovider` is read-only compatibility for old rows. New rows use Name.com.
	provider: z.enum(["namecom", "openprovider"]).nullable(),
	dns: domainDnsSchema.nullable(),
	error: z.string().nullable(),
	createdAt: isoDateTimeSchema,
	updatedAt: isoDateTimeSchema,
});

export type Domain = z.infer<typeof domainSchema>;

export const domainAvailabilityStatuses = [
	"available",
	"unavailable",
	"premium_blocked",
] as const;

export const domainAvailabilityStatusSchema = z.enum(
	domainAvailabilityStatuses,
);

export type DomainAvailabilityStatus = z.infer<
	typeof domainAvailabilityStatusSchema
>;

export const searchDomainsQuerySchema = z.object({
	q: sanitizedDomainInputSchema.pipe(z.string().min(2).max(253)),
});

export type SearchDomainsQuery = z.infer<typeof searchDomainsQuerySchema>;

export const searchDomainsResultSchema = z.object({
	name: domainNameSchema,
	tld: domainTldSchema,
	availability: domainAvailabilityStatusSchema,
	// Retail price in USD, derived server-side from live wholesale plus margin.
	// `null` means there is no safe purchasable quote (premium, missing, or
	// over-ceiling wholesale) — never substitute a mock or fallback price.
	// The registrar's wholesale quote stays server-side and never crosses the wire.
	registrationPriceUsd: z.number().positive().nullable(),
});

export type SearchDomainsResult = z.infer<typeof searchDomainsResultSchema>;

export const searchDomainsResponseSchema = z.object({
	results: z.array(searchDomainsResultSchema),
});

export type SearchDomainsResponse = z.infer<typeof searchDomainsResponseSchema>;

export const listDomainsResponseSchema = z.object({
	domains: z.array(domainSchema),
});

export type ListDomainsResponse = z.infer<typeof listDomainsResponseSchema>;

export const attachExternalDomainBodySchema = z.object({
	name: externalDomainNameSchema,
});

export type AttachExternalDomainBody = z.infer<
	typeof attachExternalDomainBodySchema
>;

export const attachExternalDomainResponseSchema = z.object({
	domain: domainSchema,
	requiredRecords: z.array(requiredDomainRecordSchema),
});

export type AttachExternalDomainResponse = z.infer<
	typeof attachExternalDomainResponseSchema
>;

export const verifyDomainResponseSchema = z.object({
	domain: domainSchema,
	requiredRecords: z.array(requiredDomainRecordSchema).optional(),
});

export type VerifyDomainResponse = z.infer<typeof verifyDomainResponseSchema>;

export const dnsRecordDiagnosticStatuses = [
	"found",
	"missing",
	"mismatch",
	"unknown",
] as const;

export const dnsRecordDiagnosticStatusSchema = z.enum(
	dnsRecordDiagnosticStatuses,
);

export type DnsRecordDiagnosticStatus = z.infer<
	typeof dnsRecordDiagnosticStatusSchema
>;

export const dnsRecordDiagnosticSchema = requiredDomainRecordSchema.extend({
	observedValues: z.array(z.string()),
	status: dnsRecordDiagnosticStatusSchema,
});

export type DnsRecordDiagnostic = z.infer<typeof dnsRecordDiagnosticSchema>;

export const getDomainDnsStatusResponseSchema = z.object({
	checkedAt: isoDateTimeSchema,
	domain: domainSchema,
	records: z.array(dnsRecordDiagnosticSchema),
});

export type GetDomainDnsStatusResponse = z.infer<
	typeof getDomainDnsStatusResponseSchema
>;

export const updateDomainAutoRenewBodySchema = z.object({
	autoRenew: z.boolean(),
});

export type UpdateDomainAutoRenewBody = z.infer<
	typeof updateDomainAutoRenewBodySchema
>;

export const updateDomainAutoRenewResponseSchema = z.object({
	domain: domainSchema,
});

export type UpdateDomainAutoRenewResponse = z.infer<
	typeof updateDomainAutoRenewResponseSchema
>;

export const setPrimaryDomainResponseSchema = z.object({
	domain: domainSchema,
});

export type SetPrimaryDomainResponse = z.infer<
	typeof setPrimaryDomainResponseSchema
>;

export const transferUnlockDomainResponseSchema = z.object({
	authCode: z.string().min(1),
	lockedUntil: isoDateTimeSchema.optional(),
});

export type TransferUnlockDomainResponse = z.infer<
	typeof transferUnlockDomainResponseSchema
>;

export const detachDomainResponseSchema = z.object({
	domain: domainSchema,
});

export type DetachDomainResponse = z.infer<typeof detachDomainResponseSchema>;

export const domainsRoutes = {
	search: "/api/v1/domains/search",
	listByProject: (projectId: string) => `/api/v1/projects/${projectId}/domains`,
	external: (projectId: string) =>
		`/api/v1/projects/${projectId}/domains/external`,
	verify: (domainId: string) => `/api/v1/domains/${domainId}/verify`,
	dnsStatus: (domainId: string) => `/api/v1/domains/${domainId}/dns-status`,
	autoRenew: (domainId: string) => `/api/v1/domains/${domainId}/auto-renew`,
	primary: (domainId: string) => `/api/v1/domains/${domainId}/primary`,
	transferUnlock: (domainId: string) =>
		`/api/v1/domains/${domainId}/transfer-unlock`,
	detach: (domainId: string) => `/api/v1/domains/${domainId}`,
} as const;
