// The admin publications feature consumes the shared API contract directly.
// These re-exports are the only publication types feature code should import —
// the contract in @wandit/contracts is the source of truth.
import type {
	AdminListPublicationsQuery,
	AdminListPublicationsResponse,
	AdminPublication,
	AdminPublicationStatus,
	AdminPublicationSuspensionResponse,
	AdminSuspendPublicationInput,
	SuspendedReasonCode,
} from "@wandit/contracts";

export type {
	AdminListPublicationsQuery,
	AdminListPublicationsResponse,
	AdminPublication,
	AdminPublicationStatus,
	AdminPublicationSuspensionResponse,
	AdminSuspendPublicationInput,
	SuspendedReasonCode,
};

/** Query params the publications log UI sends to GET /api/v1/admin/publications. */
export type ListPublicationsParams = {
	page: number;
	pageSize: number;
};
