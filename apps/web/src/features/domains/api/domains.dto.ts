// Request/response types for custom domains. Source of truth is
// packages/contracts — these are derived re-exports, never redeclared here.

export type {
	AttachExternalDomainBody,
	AttachExternalDomainResponse,
	DetachDomainResponse,
	Domain,
	DomainAvailabilityStatus,
	DomainDns,
	DomainPriceSnapshot,
	DomainSource,
	DomainStatus,
	DomainTld,
	ListDomainsResponse,
	PurchaseDomainBody,
	PurchaseDomainResponse,
	Registrant,
	RenewDomainResponse,
	RequiredDomainRecord,
	SearchDomainsQuery,
	SearchDomainsResponse,
	SearchDomainsResult,
	SetPrimaryDomainResponse,
	TransferUnlockDomainResponse,
	UpdateDomainAutoRenewBody,
	UpdateDomainAutoRenewResponse,
	VerifyDomainResponse,
} from "@wandit/contracts";
