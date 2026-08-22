/**
 * Secondary label key for a ledger row, from the metering `reason` the server
 * stores in `meta`. Post-settlement adjustments (gateway reconciliation, the
 * settle-time refund of an unused reserve, a late completion charge) would
 * otherwise read as unexplained "credits used"/"credits reversed" rows.
 */
export type LedgerReasonKey =
	| "fixedCompletion"
	| "reconcile"
	| "reconcileRefund"
	| "refund"
	| "reserve"
	| "settle"
	| "settleRefund";

const REASON_KEYS: Record<string, LedgerReasonKey> = {
	ai_usage_fixed_completion: "fixedCompletion",
	ai_usage_reconcile: "reconcile",
	ai_usage_reconcile_refund: "reconcileRefund",
	ai_usage_refund: "refund",
	ai_usage_reserve: "reserve",
	ai_usage_settle: "settle",
	ai_usage_settle_refund: "settleRefund",
};

export function ledgerReasonKey(
	meta: Record<string, unknown> | null | undefined,
): LedgerReasonKey | null {
	const reason = meta?.reason;

	if (typeof reason !== "string") {
		return null;
	}

	return REASON_KEYS[reason] ?? null;
}

/** Adjustment rows explain themselves; reserves and plain settles stay quiet. */
export function isLedgerAdjustmentReason(
	key: LedgerReasonKey | null,
): key is LedgerReasonKey {
	return (
		key === "fixedCompletion" ||
		key === "reconcile" ||
		key === "reconcileRefund" ||
		key === "refund" ||
		key === "settleRefund"
	);
}
