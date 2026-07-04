import type { CreditLedgerResponse, CreditLedgerRow } from "@wandit/contracts";

import type { CreditLedgerRow as DbCreditLedgerRow } from "../persistence/credits.repository";

export function mapCreditLedgerRow(row: DbCreditLedgerRow): CreditLedgerRow {
	return {
		bucket: row.bucket,
		createdAt: row.createdAt.toISOString(),
		delta: row.delta,
		id: row.id,
		kind: row.kind,
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
