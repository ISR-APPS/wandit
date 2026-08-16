// Public surface consumed by workspace Settings. Pages are not exported from
// feature barrels.
export type {
	DnsRecordDiagnostic,
	DnsRecordDiagnosticStatus,
	Domain,
	DomainAvailabilityStatus,
	DomainSource,
	DomainStatus,
	DomainTld,
	GetDomainDnsStatusResponse,
	RequiredDomainRecord,
	SearchDomainsResult,
} from "./api/domains.dto";
export {
	useAttachExternalDomain,
	useDetachDomain,
	useSetPrimaryDomain,
	useTransferUnlockDomain,
	useUpdateDomainAutoRenew,
	useVerifyDomain,
} from "./api/domains.mutations";
export {
	domainKeys,
	useDomainDnsStatusQuery,
	useDomainSearchQuery,
	useDomainsQuery,
} from "./api/domains.queries";
export { ExternalDomainConnectDialog } from "./components/connect-external-domain";
export { DomainsSection } from "./components/domains-section";
export { DOMAIN_SEARCH_DEBOUNCE_MS } from "./lib/constants";
export {
	domainLiveUrl,
	hasTransitionalDomains,
	isDomainTransitional,
} from "./lib/helpers";
export { useDebouncedValue } from "./lib/hooks";
