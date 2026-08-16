// Request/response types for custom domains. Source of truth is
// packages/contracts — these are derived re-exports, never redeclared here.

export type {
	AttachExternalDomainBody,
	AttachExternalDomainResponse,
	DetachDomainResponse,
	DnsRecordDiagnostic,
	DnsRecordDiagnosticStatus,
	Domain,
	DomainAvailabilityStatus,
	DomainDns,
	DomainSource,
	DomainStatus,
	DomainTld,
	GetDomainDnsStatusResponse,
	ListDomainsResponse,
	Registrant,
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
