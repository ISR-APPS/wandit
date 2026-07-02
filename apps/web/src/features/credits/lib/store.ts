import { useSyncExternalStore } from "react";

import { CREDITS_COPY, SIGNUP_GRANT } from "./constants";

export type LedgerKind = "grant" | "consume" | "topup" | "expire";

export type LedgerEntry = {
	id: string;
	kind: LedgerKind;
	/** Signed: grant/topup positive, consume/expire negative. */
	amount: number;
	label: string;
	createdAt: string;
};

const STORAGE_KEY = "wandit-mock-ledger";
const EMPTY: LedgerEntry[] = [];

function makeId(): string {
	return `led_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function seed(): LedgerEntry[] {
	return [
		{
			id: makeId(),
			kind: "grant",
			amount: SIGNUP_GRANT,
			label: CREDITS_COPY.seedGrantLabel,
			createdAt: new Date().toISOString(),
		},
	];
}

function persist(entries: LedgerEntry[]): void {
	try {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
	} catch {
		// storage unavailable — ledger stays in-memory
	}
}

function load(): LedgerEntry[] {
	if (typeof window === "undefined") return EMPTY;
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (raw) {
			const parsed = JSON.parse(raw) as LedgerEntry[];
			if (Array.isArray(parsed)) return parsed;
		}
	} catch {
		// fall through to reseed
	}
	const seeded = seed();
	persist(seeded);
	return seeded;
}

let snapshot: LedgerEntry[] = load();
const listeners = new Set<() => void>();

function emit() {
	for (const listener of listeners) listener();
}

export function getBalance(entries: LedgerEntry[]): number {
	return entries.reduce((sum, entry) => sum + entry.amount, 0);
}

export const ledgerStore = {
	subscribe(listener: () => void): () => void {
		listeners.add(listener);
		return () => listeners.delete(listener);
	},
	/** Newest entry first. */
	getSnapshot(): LedgerEntry[] {
		return snapshot;
	},
	getServerSnapshot(): LedgerEntry[] {
		return EMPTY;
	},
	append(entry: Omit<LedgerEntry, "id" | "createdAt">): void {
		snapshot = [
			{ ...entry, id: makeId(), createdAt: new Date().toISOString() },
			...snapshot,
		];
		persist(snapshot);
		emit();
	},
};

export function useLedger(): LedgerEntry[] {
	return useSyncExternalStore(
		ledgerStore.subscribe,
		ledgerStore.getSnapshot,
		ledgerStore.getServerSnapshot,
	);
}
