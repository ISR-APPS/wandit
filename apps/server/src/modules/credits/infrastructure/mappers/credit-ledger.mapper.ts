import type { CreditLedgerResponse, CreditLedgerRow } from "@wandit/contracts";

import type { CreditLedgerRow as DbCreditLedgerRow } from "../persistence/credits.repository";

export function mapCreditLedgerRow(row: DbCreditLedgerRow): CreditLedgerRow {
	return {
		bucket: row.bucket,
		createdAt: row.createdAt.toISOString(),
		// Presentation boundary: the stored delta is integer centi-credits; the
		// API contract carries decimal display credits.
		delta: row.delta / 100,
		id: row.id,
		kind: row.kind,
		// meta passes through in INTERNAL units: any embedded amounts
		// (idempotencyFingerprint.amount, bucketSplit, refill.*, …) are
		// centi-credit integers, not display credits.
		meta: isRecord(row.meta) ? row.meta : null,
		organizationId: row.organizationId,
	};
}

export function mapCreditLedgerPage(page: {
	items: DbCreditLedgerRow[];
	page: number;
	pageSize: number;
	total: number;
}): CreditLedgerResponse {
	return {
		items: page.items.map(mapCreditLedgerRow),
		page: page.page,
		pageSize: page.pageSize,
		total: page.total,
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
