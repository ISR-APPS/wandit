import { useCallback, useMemo } from "react";

import { getBalance, type LedgerEntry, ledgerStore, useLedger } from "./store";

export type UseCreditsResult = {
	balance: number;
	ledger: LedgerEntry[];
	canAfford: (cost: number) => boolean;
	/** Appends a consume entry; returns false (and writes nothing) if unaffordable. */
	consume: (cost: number, label: string) => boolean;
};

export function useCredits(): UseCreditsResult {
	const ledger = useLedger();
	const balance = useMemo(() => getBalance(ledger), [ledger]);

	const canAfford = useCallback((cost: number) => balance >= cost, [balance]);

	const consume = useCallback((cost: number, label: string): boolean => {
		if (getBalance(ledgerStore.getSnapshot()) < cost) return false;
		ledgerStore.append({ kind: "consume", amount: -cost, label });
		return true;
	}, []);

	return { balance, ledger, canAfford, consume };
}
