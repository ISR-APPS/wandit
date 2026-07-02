// Module-level mock lead store, persisted to localStorage as a
// Record<projectId, Lead[]>. Each project's book of leads is generated once
// from a PRNG seeded on the project id (so every visit renders the same
// leads) and then mutated in place by the status pipeline.

import type { Lead, LeadSource, LeadStatus } from "../api/dto";
import { hashString } from "./helpers";

const STORAGE_KEY = "wandit-mock-leads";
const MAX_SEED_COUNT = 250;

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/** mulberry32 — tiny deterministic PRNG, returns floats in [0, 1). */
function mulberry32(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
	};
}

function pick<T>(rand: () => number, pool: T[]): T {
	return pool[Math.floor(rand() * pool.length)];
}

function pickWeighted<T>(rand: () => number, entries: [T, number][]): T {
	let roll = rand();
	for (const [value, weight] of entries) {
		roll -= weight;
		if (roll < 0) return value;
	}
	return entries[entries.length - 1][0];
}

// Buyer names — Algerian mix, Latin script dominant with a real share of
// Arabic-script entries so RTL rendering is exercised everywhere.
const LATIN_FIRST_NAMES = [
	"Amine",
	"Ikram",
	"Yacine",
	"Lina",
	"Sofiane",
	"Meriem",
	"Walid",
	"Sara",
	"Nassim",
	"Rania",
	"Khaled",
	"Imene",
	"Mehdi",
	"Aya",
];

const LATIN_LAST_NAMES = [
	"Bousbia",
	"Haddad",
	"Benali",
	"Mansouri",
	"Cherif",
	"Zerhouni",
	"Guerroudj",
	"Bendjema",
	"Belkacem",
	"Boudjellal",
	"Saidi",
	"Meziane",
	"Hamidi",
	"Aouar",
];

const ARABIC_FIRST_NAMES = [
	"سفيان",
	"خديجة",
	"محمد الأمين",
	"نور الهدى",
	"عبد الرحمن",
	"أميرة",
	"يوسف",
	"فاطمة الزهراء",
];

const ARABIC_LAST_NAMES = [
	"مرابط",
	"بلعباس",
	"قادري",
	"شريف",
	"بوعلام",
	"حمداني",
	"زروقي",
	"بن ناصر",
];

/** Real wilaya → commune pairs, weighted toward the big markets. */
const LOCATIONS: [wilaya: string, commune: string][] = [
	["Alger", "Bab Ezzouar"],
	["Alger", "Hydra"],
	["Alger", "Kouba"],
	["Alger", "Birkhadem"],
	["Oran", "Bir El Djir"],
	["Oran", "Es Senia"],
	["Sétif", "El Eulma"],
	["Sétif", "Aïn Arnat"],
	["Constantine", "El Khroub"],
	["Blida", "Boufarik"],
	["Batna", "Tazoult"],
	["Annaba", "El Bouni"],
	["Tlemcen", "Mansourah"],
	["Tizi Ouzou", "Azazga"],
	["Béjaïa", "Akbou"],
	["Djelfa", "Aïn Oussera"],
	["Mostaganem", "Kheir Eddine"],
];

const STATUS_WEIGHTS: [LeadStatus, number][] = [
	["to_confirm", 0.3],
	["confirmed", 0.25],
	["shipped", 0.15],
	["delivered", 0.2],
	["returned", 0.04],
	["cancelled", 0.06],
];

const SOURCE_WEIGHTS: [LeadSource, number][] = [
	["facebook", 0.45],
	["tiktok", 0.4],
	["direct", 0.15],
];

function generateName(rand: () => number): string {
	if (rand() < 0.65) {
		return `${pick(rand, LATIN_FIRST_NAMES)} ${pick(rand, LATIN_LAST_NAMES)}`;
	}
	return `${pick(rand, ARABIC_FIRST_NAMES)} ${pick(rand, ARABIC_LAST_NAMES)}`;
}

/** Canonical E.164 Algerian mobile: +213 then (5|6|7) and 8 digits. */
function generatePhone(rand: () => number): string {
	let digits = pick(rand, ["5", "6", "7"]);
	for (let i = 0; i < 8; i++) {
		digits += String(Math.floor(rand() * 10));
	}
	return `+213${digits}`;
}

/** ~25% in the last 24h, ~30% more in the last week, rest across 30 days. */
function generateCreatedAt(rand: () => number, now: number): string {
	const roll = rand();
	let agoMs: number;
	if (roll < 0.25) {
		agoMs = rand() * 24 * HOUR_MS;
	} else if (roll < 0.55) {
		agoMs = DAY_MS + rand() * 6 * DAY_MS;
	} else {
		agoMs = 7 * DAY_MS + rand() * 23 * DAY_MS;
	}
	return new Date(now - agoMs).toISOString();
}

function seedLeads(projectId: string, seedCount: number): Lead[] {
	const rand = mulberry32(hashString(projectId));
	const now = Date.now();
	const count = Math.min(seedCount, MAX_SEED_COUNT);
	const leads: Lead[] = [];
	for (let i = 0; i < count; i++) {
		const [wilaya, commune] = pick(rand, LOCATIONS);
		leads.push({
			id: `l_${projectId.replace(/^p_/, "")}_${String(i + 1).padStart(3, "0")}`,
			name: generateName(rand),
			phone: generatePhone(rand),
			wilaya,
			commune,
			createdAt: generateCreatedAt(rand, now),
			status: pickWeighted(rand, STATUS_WEIGHTS),
			source: pickWeighted(rand, SOURCE_WEIGHTS),
		});
	}
	return leads;
}

let cache: Record<string, Lead[]> | null = null;

function load(): Record<string, Lead[]> {
	if (cache) return cache;
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (raw) {
			cache = JSON.parse(raw) as Record<string, Lead[]>;
			return cache;
		}
	} catch {
		// unreadable storage — fall through to a fresh store
	}
	cache = {};
	persist(cache);
	return cache;
}

function persist(store: Record<string, Lead[]>): void {
	cache = store;
	try {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
	} catch {
		// storage unavailable — in-memory cache still serves the session
	}
}

export function listMockLeads(projectId: string, seedCount: number): Lead[] {
	const store = load();
	let leads = store[projectId];
	if (!leads) {
		leads = seedLeads(projectId, seedCount);
		persist({ ...store, [projectId]: leads });
	}
	return [...leads].sort(
		(a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
	);
}

export function updateMockLeadStatus(
	projectId: string,
	leadId: string,
	status: LeadStatus,
): Lead {
	const store = load();
	const leads = store[projectId] ?? [];
	const target = leads.find((lead) => lead.id === leadId);
	if (!target) throw new Error("Lead not found");
	const updated: Lead = { ...target, status };
	persist({
		...store,
		[projectId]: leads.map((lead) => (lead.id === leadId ? updated : lead)),
	});
	return updated;
}
