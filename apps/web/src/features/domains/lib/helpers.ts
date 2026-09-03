import type { Registrant } from "@wandit/contracts";

import type {
	Domain,
	DomainStatus,
	RequiredDomainRecord,
	SearchDomainsResult,
} from "../api/domains.dto";
import {
	DEFAULT_REGISTRANT_COUNTRY,
	TRANSITIONAL_DOMAIN_STATUSES,
} from "./constants";
import type { RegistrantFlatFormValues } from "./schemas";

export function isDomainTransitional(status: DomainStatus) {
	return (TRANSITIONAL_DOMAIN_STATUSES as readonly DomainStatus[]).includes(
		status,
	);
}

export function hasTransitionalDomains(domains: Domain[] | undefined) {
	return (
		domains?.some(
			(domain) =>
				isDomainTransitional(domain.status) &&
				!(domain.source === "external" && domain.dns?.externalVerification),
		) ?? false
	);
}

export function domainLiveUrl(domain: Pick<Domain, "name" | "source">) {
	const hostname =
		domain.source === "external" ? `www.${domain.name}` : domain.name;

	return `https://${hostname}`;
}

export function normalizeDomainInput(value: string) {
	return value
		.trim()
		.toLowerCase()
		.replace(/^https?:\/\//, "")
		.replace(/\/.*$/, "");
}

export function isAvailableSearchResult(result: SearchDomainsResult) {
	return result.availability === "available";
}

export function createRegistrantDefaults(user?: {
	name?: string | null;
	displayEmail?: string | null;
	email?: string | null;
}): RegistrantFlatFormValues {
	const { firstName, lastName } = splitDisplayName(user?.name);

	return {
		firstName,
		lastName,
		// This is an editable prefill; both spellings reach the same inbox.
		email: user?.displayEmail ?? user?.email ?? "",
		phone: "",
		companyName: "",
		street: "",
		city: "",
		wilaya: "",
		zip: "",
		countryCode: DEFAULT_REGISTRANT_COUNTRY,
	};
}

export function splitDisplayName(name: string | null | undefined) {
	const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
	const [firstName = "", ...rest] = parts;

	return {
		firstName,
		lastName: rest.join(" "),
	};
}

export function toRegistrantBody(values: RegistrantFlatFormValues): Registrant {
	const companyName = values.companyName?.trim();

	return {
		firstName: values.firstName.trim(),
		lastName: values.lastName.trim(),
		email: values.email.trim(),
		// Users paste numbers as "+213 (555) 12-34-56"; the registrar wants
		// bare E.164, so formatting characters are stripped, not rejected.
		phone: values.phone.replace(/[\s().-]/g, ""),
		address: {
			street: values.street.trim(),
			city: values.city.trim(),
			wilaya: values.wilaya.trim(),
			zip: values.zip.trim(),
			countryCode: values.countryCode.trim().toUpperCase(),
		},
		...(companyName ? { companyName } : {}),
	};
}

export type RegistrantFormField = keyof RegistrantFlatFormValues;

export function registrantPathToField(
	path: PropertyKey[],
): RegistrantFormField | null {
	const joined = path.join(".");

	switch (joined) {
		case "firstName":
		case "lastName":
		case "email":
		case "phone":
		case "companyName":
			return joined;
		case "address.street":
			return "street";
		case "address.city":
			return "city";
		case "address.wilaya":
			return "wilaya";
		case "address.zip":
			return "zip";
		case "address.countryCode":
			return "countryCode";
		default:
			return null;
	}
}

export function safeDomainErrorSummary(error: string | null | undefined) {
	const summary = error
		?.replace(/https?:\/\/\S+/gi, "")
		.replace(/[^\p{L}\p{N}\s.,:;!?()[\]_-]/gu, "")
		.replace(/\s+/g, " ")
		.trim();

	return summary ? summary.slice(0, 180) : null;
}

export function isNameserverRecord(record: RequiredDomainRecord) {
	return record.type === "NS" || record.purpose.toLowerCase() === "nameserver";
}

// External rows with a Wandit zone carry NS records next to the www records:
// option A (delegate the nameservers) versus option B (add the www records).
export function splitExternalDomainRecords(records: RequiredDomainRecord[]) {
	const nameserverRecords: RequiredDomainRecord[] = [];
	const manualRecords: RequiredDomainRecord[] = [];

	for (const record of records) {
		(isNameserverRecord(record) ? nameserverRecords : manualRecords).push(
			record,
		);
	}

	return { manualRecords, nameserverRecords };
}

export function dnsPurposeKey(record: RequiredDomainRecord) {
	const normalizedPurpose = record.purpose.toLowerCase();
	const type = record.type;
	const name = record.name.toLowerCase();

	if (isNameserverRecord(record)) {
		return "settings.domains.dnsPurposeNameserver" as const;
	}

	if (type === "TXT" || normalizedPurpose.includes("ownership")) {
		return "settings.domains.dnsPurposeOwnership" as const;
	}

	if (type === "CNAME" || name === "www") {
		return "settings.domains.dnsPurposeRouting" as const;
	}

	if (type === "A" || type === "AAAA") {
		return "settings.domains.dnsPurposeApex" as const;
	}

	return "settings.domains.dnsPurposeGeneric" as const;
}
