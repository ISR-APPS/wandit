// Public surface consumed by workspace Settings. Pages are not exported from
// feature barrels.
export type {
	Domain,
	DomainAvailabilityStatus,
	DomainSource,
	DomainStatus,
	DomainTld,
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
	useDomainSearchQuery,
	useDomainsQuery,
} from "./api/domains.queries";
export { DomainsSection } from "./components/domains-section";
export { DOMAIN_SEARCH_DEBOUNCE_MS } from "./lib/constants";
export {
	externalDomainLiveUrl,
	hasTransitionalDomains,
	isDomainTransitional,
	purchasedDomainLiveUrl,
} from "./lib/helpers";
export { useDebouncedValue } from "./lib/hooks";
