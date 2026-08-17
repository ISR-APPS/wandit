import type { WorkspaceCreditBalance } from "@wandit/contracts";

/**
 * "Your credits are in {name}" hint (chip, plan picker, billing notice):
 * fires only when the ACTIVE workspace's settled balance is drained (<= 0)
 * while another workspace the user belongs to still holds settled credits.
 * Settled balances keep the hint from flashing while a running generation's
 * reserve hold temporarily dips a pool.
 *
 * Returns the richest other pool, or null when the hint must stay silent —
 * including while the balances list is unloaded or the active workspace is
 * missing from it (stale membership), so the hint always fails closed.
 */
export function findCreditsElsewhere(
	activeWorkspaceId: string,
	items: readonly WorkspaceCreditBalance[] | undefined,
): WorkspaceCreditBalance | null {
	if (!items) {
		return null;
	}

	const active = items.find((item) => item.workspaceId === activeWorkspaceId);

	if (!active || active.settledBalance > 0) {
		return null;
	}

	let best: WorkspaceCreditBalance | null = null;

	for (const item of items) {
		if (item.workspaceId === activeWorkspaceId || item.settledBalance <= 0) {
			continue;
		}

		if (!best || item.settledBalance > best.settledBalance) {
			best = item;
		}
	}

	return best;
}
