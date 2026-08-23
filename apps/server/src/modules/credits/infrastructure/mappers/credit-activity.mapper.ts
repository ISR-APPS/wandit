import type {
	CreditActivityItem,
	CreditActivityResponse,
	CreditActivityStatus,
} from "@wandit/contracts";

import type { CreditActivityRow } from "../persistence/credits.repository";

/**
 * Presentation boundary: integer centi-credits become decimal credits, and the
 * internal event status collapses to what a user may see. A user never sees
 * "reconcile failed": with final_credits the charge stands; without it the
 * hold is still open (the balance adds the reserve back), so the row stays
 * in progress. The reserve is never shown as a charge.
 */
export function mapCreditActivityRow(
	row: CreditActivityRow,
): CreditActivityItem {
	if (row.source === "ledger") {
		return {
			bucket: row.bucket,
			createdAt: row.createdAt.toISOString(),
			credits: row.delta / 100,
			finalizedAt: null,
			id: row.id,
			kind: "ledger",
			ledgerKind: row.ledgerKind,
			operation: null,
			reason: row.reason,
			status: "settled",
		};
	}

	const { credits, status } = usageCharge(row);

	return {
		bucket: null,
		createdAt: row.createdAt.toISOString(),
		credits,
		finalizedAt:
			status !== "in_progress" && row.finalizedAt
				? row.finalizedAt.toISOString()
				: null,
		id: row.id,
		kind: "usage",
		ledgerKind: null,
		operation: row.operation,
		reason: null,
		status,
	};
}

export function mapCreditActivityPage(page: {
	items: CreditActivityRow[];
	page: number;
	pageSize: number;
	total: number;
}): CreditActivityResponse {
	return {
		items: page.items.map(mapCreditActivityRow),
		page: page.page,
		pageSize: page.pageSize,
		total: page.total,
	};
}

function usageCharge(row: Extract<CreditActivityRow, { source: "usage" }>): {
	credits: number | null;
	status: CreditActivityStatus;
} {
	switch (row.status) {
		case "reserved":
			return { credits: null, status: "in_progress" };
		case "settled":
		case "reconciled":
			return { credits: spend(row.finalCredits ?? 0), status: "settled" };
		case "reconcile_failed":
			// Same rule as the repository in-flight predicate.
			return row.finalCredits === null
				? { credits: null, status: "in_progress" }
				: { credits: spend(row.finalCredits), status: "settled" };
		case "refunded":
			// The repository drops refunded rows with no charge left.
			return { credits: spend(row.finalCredits ?? 0), status: "refunded" };
	}
}

/** Charged centi-credits as a negative decimal amount (no -0). */
function spend(centiCredits: number): number {
	return centiCredits === 0 ? 0 : -centiCredits / 100;
}
