// Module-level mock project store, persisted to localStorage. Seeded with a
// realistic FR/AR/EN mix on first run; projects.services.ts wraps these CRUD
// helpers with fake latency until the real backend lands.

import type { Project } from "../api/dto";
import { deriveProjectName } from "./helpers";

const STORAGE_KEY = "wandit-mock-projects";

function iso(daysAgo: number, hoursAgo = 0): string {
	return new Date(
		Date.now() - daysAgo * 86_400_000 - hoursAgo * 3_600_000,
	).toISOString();
}

function seedProjects(): Project[] {
	return [
		{
			id: "p_montre",
			name: "Montre Vintage COD",
			prompt:
				"Page de vente COD pour une montre vintage homme, livraison 58 wilayas, paiement à la livraison",
			status: "published",
			leadCount: 128,
			createdAt: iso(6),
			updatedAt: iso(0, 5),
			thumbnailSeed: 9,
			publishedSlug: "montre-vintage",
		},
		{
			id: "p_miel",
			name: "عسل الأوراس — Miel d'Aurès",
			prompt:
				"صفحة هبوط لبيع عسل حر طبيعي من جبال الأوراس مع الدفع عند الاستلام",
			status: "published",
			leadCount: 214,
			createdAt: iso(14),
			updatedAt: iso(1),
			thumbnailSeed: 21,
			publishedSlug: "miel-aures",
		},
		{
			id: "p_serum",
			name: "Serum Éclat",
			prompt:
				"Landing page pour un sérum visage éclaircissant, cible femmes 20-35, ton premium",
			status: "publishing",
			leadCount: 0,
			createdAt: iso(2),
			updatedAt: iso(0, 1),
			thumbnailSeed: 34,
		},
		{
			id: "p_ramadan",
			name: "Pack Ramadan Dates",
			prompt:
				"Offre pack Ramadan de dattes Deglet Nour premium avec livraison gratuite dès 2 boîtes",
			status: "draft",
			leadCount: 0,
			createdAt: iso(20),
			updatedAt: iso(19),
			thumbnailSeed: 5,
		},
		{
			id: "p_dentaire",
			name: "Cabinet Dentaire Amine",
			prompt:
				"Page de prise de rendez-vous pour un cabinet dentaire à Alger, blanchiment et orthodontie",
			status: "draft",
			leadCount: 0,
			createdAt: iso(9),
			updatedAt: iso(8),
			thumbnailSeed: 42,
		},
		{
			id: "p_formation",
			name: "Formation Ads FR",
			prompt:
				"Page d'inscription pour une formation Facebook Ads en français, cohorte de 20 places",
			status: "draft",
			leadCount: 0,
			createdAt: iso(13),
			updatedAt: iso(12),
			thumbnailSeed: 17,
		},
		{
			id: "p_sneakers",
			name: "Sneakers Drop DZ",
			prompt:
				"Drop page for limited sneakers in Algiers, countdown urgency, cash on delivery",
			status: "published",
			leadCount: 67,
			createdAt: iso(5),
			updatedAt: iso(3),
			thumbnailSeed: 78,
			publishedSlug: "sneakers-drop-dz",
		},
		{
			id: "p_gaming",
			name: "Gaming Chair Pro",
			prompt:
				"Landing page for an ergonomic gaming chair, comparison table, COD across Algeria",
			status: "draft",
			leadCount: 0,
			createdAt: iso(17),
			updatedAt: iso(16),
			thumbnailSeed: 91,
		},
	];
}

let cache: Project[] | null = null;

function load(): Project[] {
	if (cache) return cache;
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (raw) {
			cache = JSON.parse(raw) as Project[];
			return cache;
		}
	} catch {
		// unreadable storage — fall through to a fresh seed
	}
	cache = seedProjects();
	persist(cache);
	return cache;
}

function persist(projects: Project[]): void {
	cache = projects;
	try {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
	} catch {
		// storage unavailable — in-memory cache still serves the session
	}
}

export function listMockProjects(): Project[] {
	return [...load()].sort(
		(a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
	);
}

export function getMockProject(id: string): Project | undefined {
	return load().find((p) => p.id === id);
}

export function createMockProject(prompt: string): Project {
	const now = new Date().toISOString();
	const project: Project = {
		id: `p_${crypto.randomUUID().slice(0, 8)}`,
		name: deriveProjectName(prompt),
		prompt,
		status: "draft",
		leadCount: 0,
		createdAt: now,
		updatedAt: now,
		thumbnailSeed: Math.floor(Math.random() * 100_000),
	};
	persist([project, ...load()]);
	return project;
}

export function renameMockProject(id: string, name: string): Project {
	const projects = load();
	const target = projects.find((p) => p.id === id);
	if (!target) throw new Error("Project not found");
	const updated: Project = {
		...target,
		name,
		updatedAt: new Date().toISOString(),
	};
	persist(projects.map((p) => (p.id === id ? updated : p)));
	return updated;
}

export function deleteMockProject(id: string): void {
	persist(load().filter((p) => p.id !== id));
}
