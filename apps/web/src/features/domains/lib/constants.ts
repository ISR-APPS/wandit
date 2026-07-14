import type { DomainStatus } from "../api/domains.dto";

export const DOMAIN_SEARCH_DEBOUNCE_MS = 350;
export const DOMAIN_POLL_INTERVAL_MS = 4_000;
export const DEFAULT_REGISTRANT_COUNTRY = "DZ";

export const TRANSITIONAL_DOMAIN_STATUSES = [
	"registering",
	"configuring",
] as const satisfies readonly DomainStatus[];

export const TERMINAL_DOMAIN_STATUSES = [
	"active",
	"failed",
	"expired",
	"transferred_out",
] as const satisfies readonly DomainStatus[];

export const DOMAIN_STATUS_ORDER = [
	"registering",
	"configuring",
	"active",
	"failed",
	"expired",
	"transferred_out",
] as const satisfies readonly DomainStatus[];
