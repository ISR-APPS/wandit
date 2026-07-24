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
 * Fail-closed guards around Name.com's registration quote.
 *
 * Each cap has headroom above the registrar's normal price so ordinary domains
 * stay purchasable, while an unexpected premium/price spike is still blocked.
 * The UI displays Name.com's actual quote—never these cap values.
 */
export const DOMAIN_TLD_CATALOG = {
	com: {
		wholesaleCeilingUsd: 30,
	},
	net: {
		wholesaleCeilingUsd: 35,
	},
	shop: {
		wholesaleCeilingUsd: 90,
	},
	store: {
		wholesaleCeilingUsd: 100,
	},
	online: {
		wholesaleCeilingUsd: 75,
	},
	site: {
		wholesaleCeilingUsd: 75,
	},
} as const satisfies Record<DomainTld, DomainTldCatalogItem>;

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

export const requiredDomainRecordSchema = z.object({
	type: z.enum(["A", "AAAA", "CNAME", "TXT"]),
	name: z.string().min(1),
	value: z.string().min(1),
	purpose: z.string().min(1),
});

export type RequiredDomainRecord = z.infer<typeof requiredDomainRecordSchema>;

export const domainDnsSchema = z
	.object({
		records: z.array(requiredDomainRecordSchema).optional(),
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
	// `null` means Name.com did not return a safe, purchasable USD quote.
	// Never replace it with a mock or catalog fallback price.
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

export const purchaseDomainBodySchema = z.object({
	name: domainNameSchema,
	registrant: registrantSchema,
});

export type PurchaseDomainBody = z.infer<typeof purchaseDomainBodySchema>;

/*
 * PAYMENT TODO:
 * The route currently fails closed before returning this legacy shape. When
 * PaymentsModule is ready, replace it with a checkout-session response; the
 * verified payment webhook will create and return/provision the Domain later.
 */
export const purchaseDomainResponseSchema = z.object({
	domain: domainSchema,
});

export type PurchaseDomainResponse = z.infer<
	typeof purchaseDomainResponseSchema
>;

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

export const renewDomainResponseSchema = z.object({
	domain: domainSchema,
});

export type RenewDomainResponse = z.infer<typeof renewDomainResponseSchema>;

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
	purchase: (projectId: string) => `/api/v1/projects/${projectId}/domains`,
	external: (projectId: string) =>
		`/api/v1/projects/${projectId}/domains/external`,
	verify: (domainId: string) => `/api/v1/domains/${domainId}/verify`,
	renew: (domainId: string) => `/api/v1/domains/${domainId}/renew`,
	autoRenew: (domainId: string) => `/api/v1/domains/${domainId}/auto-renew`,
	primary: (domainId: string) => `/api/v1/domains/${domainId}/primary`,
	transferUnlock: (domainId: string) =>
		`/api/v1/domains/${domainId}/transfer-unlock`,
	detach: (domainId: string) => `/api/v1/domains/${domainId}`,
} as const;
