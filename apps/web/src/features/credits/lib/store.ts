import { useSyncExternalStore } from "react";

import type { TranslationKey, TranslationParams } from "@/lib/i18n";
import { SIGNUP_GRANT } from "./constants";

export type LedgerKind = "grant" | "consume" | "topup" | "expire";

type LedgerLabel =
	| {
			labelKey: TranslationKey;
			labelParams?: TranslationParams;
			label?: string;
	  }
	| {
			labelKey?: undefined;
			labelParams?: undefined;
			label: string;
	  };

type LedgerEntryBase = {
	id: string;
	kind: LedgerKind;
	/** Signed: grant/topup positive, consume/expire negative. */
	amount: number;
	createdAt: string;
};

export type LedgerEntry = LedgerEntryBase & LedgerLabel;
type LedgerEntryInput = Omit<LedgerEntryBase, "id" | "createdAt"> & LedgerLabel;

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
			labelKey: "credits.seedGrantLabel",
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
			if (Array.isArray(parsed)) return refillWhenLow(parsed);
		}
	} catch {
		// fall through to reseed
	}
	const seeded = seed();
	persist(seeded);
	return seeded;
}

// Dev self-heal: the mock ledger drains as you test and old drained ledgers
// survive in localStorage, blocking every action. Top it back up on load so
// local work is never blocked. Dies with the whole mock once the UI reads the
// real server balance (credit_ledger table).
function refillWhenLow(entries: LedgerEntry[]): LedgerEntry[] {
	if (getBalance(entries) >= 1_000) return entries;
	const refilled: LedgerEntry[] = [
		{
			id: makeId(),
			kind: "topup",
			amount: SIGNUP_GRANT,
			labelKey: "credits.seedGrantLabel",
			createdAt: new Date().toISOString(),
		},
		...entries,
	];
	persist(refilled);
	return refilled;
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
	append(entry: LedgerEntryInput): void {
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
