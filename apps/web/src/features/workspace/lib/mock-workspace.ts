// Module-level mock workspace store — chat messages, immutable versions,
// deployment pointer and pixel settings per project — persisted to
// localStorage. Seeded with coherent histories for the seeded dashboard
// projects; unknown projects start empty so the workspace auto-runs their
// first generation. workspace.services.ts wraps these helpers.

import type {
	ChatMessage,
	Deployment,
	MessagePart,
	PageVersion,
	PixelSettings,
	WorkspaceState,
} from "../api/dto";

const STORAGE_KEY = "wandit-mock-workspace";

function iso(daysAgo: number, hoursAgo = 0, minutesAgo = 0): string {
	return new Date(
		Date.now() -
			daysAgo * 86_400_000 -
			hoursAgo * 3_600_000 -
			minutesAgo * 60_000,
	).toISOString();
}

const DRAFT_DEPLOYMENT: Deployment = {
	state: "draft",
	slug: null,
	publishedVersionId: null,
	publishedAt: null,
};

const NO_PIXELS: PixelSettings = { metaPixelId: null, tiktokPixelId: null };

function emptyState(): WorkspaceState {
	return {
		messages: [],
		versions: [],
		deployment: { ...DRAFT_DEPLOYMENT },
		pixels: { ...NO_PIXELS },
	};
}

// --- seed helpers ---------------------------------------------------------

function text(value: string): MessagePart {
	return { type: "text", text: value };
}

function gen(
	versionId: string,
	versionNumber: number,
	summary: string,
): MessagePart {
	return {
		type: "generation",
		status: "complete",
		versionId,
		versionNumber,
		summary,
	};
}

function msg(
	id: string,
	role: ChatMessage["role"],
	parts: MessagePart[],
	createdAt: string,
): ChatMessage {
	return { id, role, parts, createdAt };
}

function version(
	id: string,
	number: number,
	label: string,
	lang: PageVersion["lang"],
	pageKey: string,
	createdAt: string,
): PageVersion {
	return { id, number, label, lang, pageKey, createdAt };
}

// Seeded histories mirror lib/mock-projects.ts seeds (same project ids) so
// the dashboard cards and the workspace tell one coherent story.
function seedFor(projectId: string): WorkspaceState {
	switch (projectId) {
		case "p_montre":
			return {
				versions: [
					version(
						"v_montre_1",
						1,
						"Initial generation",
						"fr",
						"watch-1",
						iso(6),
					),
					version(
						"v_montre_2",
						2,
						"Avis clients + FAQ",
						"fr",
						"watch-2",
						iso(3),
					),
					version(
						"v_montre_3",
						3,
						"Compte à rebours + offres par lot",
						"fr",
						"watch-3",
						iso(0, 5),
					),
				],
				messages: [
					msg(
						"m_montre_1",
						"user",
						[
							text(
								"Page de vente COD pour une montre vintage homme, livraison 58 wilayas, paiement à la livraison",
							),
						],
						iso(6, 0, 9),
					),
					msg(
						"m_montre_2",
						"assistant",
						[
							text(
								"Très bon brief. Je construis une page mobile-first : un hero fort, les bénéfices produit, de la preuve sociale et un formulaire de commande à la livraison. Première version en cours.",
							),
							gen("v_montre_1", 1, "Initial generation"),
						],
						iso(6),
					),
					msg(
						"m_montre_3",
						"user",
						[
							text(
								"Ajoute une section avis clients et une FAQ pour rassurer avant l'achat",
							),
						],
						iso(3, 0, 7),
					),
					msg(
						"m_montre_4",
						"assistant",
						[
							text(
								"C'est fait — trois avis clients avec notes, et une FAQ qui couvre la livraison, le retour et la garantie. Nouvelle version générée.",
							),
							gen("v_montre_2", 2, "Avis clients + FAQ"),
						],
						iso(3),
					),
					msg(
						"m_montre_5",
						"user",
						[
							text(
								"Ajoute un compte à rebours et des offres par lot : 1, 2 ou 3 montres",
							),
						],
						iso(0, 5, 8),
					),
					msg(
						"m_montre_6",
						"assistant",
						[
							text(
								"Urgence ajoutée : compte à rebours jusqu'à minuit et trois offres par lot avec remise dégressive. La v3 est prête à publier.",
							),
							gen("v_montre_3", 3, "Compte à rebours + offres par lot"),
						],
						iso(0, 5),
					),
				],
				deployment: {
					state: "published",
					slug: "montre-vintage",
					publishedVersionId: "v_montre_2",
					publishedAt: iso(1),
				},
				pixels: { metaPixelId: "728394056171245", tiktokPixelId: null },
			};

		case "p_miel":
			return {
				versions: [
					version("v_miel_1", 1, "النسخة الأولى", "ar", "honey-1", iso(14)),
					version(
						"v_miel_2",
						2,
						"آراء الزبائن وخيارات الوزن",
						"ar",
						"honey-2",
						iso(1),
					),
				],
				messages: [
					msg(
						"m_miel_1",
						"user",
						[
							text(
								"صفحة هبوط لبيع عسل حر طبيعي من جبال الأوراس مع الدفع عند الاستلام",
							),
						],
						iso(14, 0, 6),
					),
					msg(
						"m_miel_2",
						"assistant",
						[
							text(
								"ممتاز — أبني صفحة هبوط للهاتف أولاً: مقدمة قوية، فوائد المنتج، ثم استمارة الطلب مع الدفع عند الاستلام. النسخة الأولى قيد الإنشاء.",
							),
							gen("v_miel_1", 1, "النسخة الأولى"),
						],
						iso(14),
					),
					msg(
						"m_miel_3",
						"user",
						[text("أضف آراء الزبائن وخيارات الوزن: 500غ، 1كغ و2كغ")],
						iso(1, 0, 10),
					),
					msg(
						"m_miel_4",
						"assistant",
						[
							text(
								"تم — أضفت ثلاث شهادات من الزبائن وبطاقات لاختيار الوزن مع الأسعار. النسخة الثانية جاهزة.",
							),
							gen("v_miel_2", 2, "آراء الزبائن وخيارات الوزن"),
						],
						iso(1),
					),
				],
				deployment: {
					state: "published",
					slug: "miel-aures",
					publishedVersionId: "v_miel_2",
					publishedAt: iso(1),
				},
				pixels: { metaPixelId: null, tiktokPixelId: "C9A8B7C6D5E4F3" },
			};

		case "p_serum":
			return {
				versions: [
					version(
						"v_serum_1",
						1,
						"Initial generation",
						"fr",
						"serum-1",
						iso(0, 1),
					),
				],
				messages: [
					msg(
						"m_serum_1",
						"user",
						[
							text(
								"Landing page pour un sérum visage éclaircissant, cible femmes 20-35, ton premium",
							),
						],
						iso(0, 1, 6),
					),
					msg(
						"m_serum_2",
						"assistant",
						[
							text(
								"Compris — ton premium, visuel épuré. J'articule la page autour de la promesse d'éclat, des actifs clés et d'une routine simple en trois étapes, avec le formulaire de commande en clôture.",
							),
							gen("v_serum_1", 1, "Initial generation"),
						],
						iso(0, 1),
					),
				],
				deployment: {
					state: "publishing",
					slug: "serum-eclat",
					publishedVersionId: null,
					publishedAt: null,
				},
				pixels: { ...NO_PIXELS },
			};

		case "p_sneakers":
			return {
				versions: [
					version(
						"v_sneakers_1",
						1,
						"Initial generation",
						"en",
						"sneakers-1",
						iso(5),
					),
					version(
						"v_sneakers_2",
						2,
						"Countdown + stock meter",
						"en",
						"sneakers-2",
						iso(3),
					),
				],
				messages: [
					msg(
						"m_sneakers_1",
						"user",
						[
							text(
								"Drop page for limited sneakers in Algiers, countdown urgency, cash on delivery",
							),
						],
						iso(5, 0, 5),
					),
					msg(
						"m_sneakers_2",
						"assistant",
						[
							text(
								"Clean drop page coming up: bold hero, size picker wired into the form, and a COD checkout. Building v1 now.",
							),
							gen("v_sneakers_1", 1, "Initial generation"),
						],
						iso(5),
					),
					msg(
						"m_sneakers_3",
						"user",
						[text("Add a countdown and show how many pairs are left")],
						iso(3, 0, 6),
					),
					msg(
						"m_sneakers_4",
						"assistant",
						[
							text(
								"Added a countdown to the drop deadline and a live stock meter — scarcity does the selling now. v2 is ready.",
							),
							gen("v_sneakers_2", 2, "Countdown + stock meter"),
						],
						iso(3),
					),
				],
				deployment: {
					state: "published",
					slug: "sneakers-drop-dz",
					publishedVersionId: "v_sneakers_2",
					publishedAt: iso(2),
				},
				pixels: { ...NO_PIXELS },
			};

		case "p_ramadan":
			return {
				versions: [
					version(
						"v_ramadan_1",
						1,
						"Initial generation",
						"fr",
						"dates-1",
						iso(19),
					),
				],
				messages: [
					msg(
						"m_ramadan_1",
						"user",
						[
							text(
								"Offre pack Ramadan de dattes Deglet Nour premium avec livraison gratuite dès 2 boîtes",
							),
						],
						iso(19, 0, 4),
					),
					msg(
						"m_ramadan_2",
						"assistant",
						[
							text(
								"Belle offre saisonnière. Je mets l'origine Tolga en avant, trois packs avec la livraison offerte dès deux boîtes, et le formulaire COD. Première version en cours.",
							),
							gen("v_ramadan_1", 1, "Initial generation"),
						],
						iso(19),
					),
				],
				deployment: { ...DRAFT_DEPLOYMENT },
				pixels: { ...NO_PIXELS },
			};

		case "p_dentaire":
			return {
				versions: [
					version(
						"v_dentaire_1",
						1,
						"Initial generation",
						"fr",
						"dental-1",
						iso(8),
					),
				],
				messages: [
					msg(
						"m_dentaire_1",
						"user",
						[
							text(
								"Page de prise de rendez-vous pour un cabinet dentaire à Alger, blanchiment et orthodontie",
							),
						],
						iso(8, 0, 5),
					),
					msg(
						"m_dentaire_2",
						"assistant",
						[
							text(
								"Page de service, donc : présentation du cabinet, grille des soins avec prix indicatifs, horaires, et un formulaire de rendez-vous à la place du panier. Génération en cours.",
							),
							gen("v_dentaire_1", 1, "Initial generation"),
						],
						iso(8),
					),
				],
				deployment: { ...DRAFT_DEPLOYMENT },
				pixels: { ...NO_PIXELS },
			};

		case "p_formation":
			return {
				versions: [
					version(
						"v_formation_1",
						1,
						"Initial generation",
						"fr",
						"formation-1",
						iso(12),
					),
				],
				messages: [
					msg(
						"m_formation_1",
						"user",
						[
							text(
								"Page d'inscription pour une formation Facebook Ads en français, cohorte de 20 places",
							),
						],
						iso(12, 0, 8),
					),
					msg(
						"m_formation_2",
						"assistant",
						[
							text(
								"Je structure la page autour du programme, du formateur et de la rareté des 20 places, avec un formulaire de préinscription. Première version en cours.",
							),
							gen("v_formation_1", 1, "Initial generation"),
						],
						iso(12),
					),
				],
				deployment: { ...DRAFT_DEPLOYMENT },
				pixels: { ...NO_PIXELS },
			};

		case "p_gaming":
			return {
				versions: [
					version(
						"v_gaming_1",
						1,
						"Initial generation",
						"en",
						"gaming-1",
						iso(16),
					),
				],
				messages: [
					msg(
						"m_gaming_1",
						"user",
						[
							text(
								"Landing page for an ergonomic gaming chair, comparison table, COD across Algeria",
							),
						],
						iso(16, 0, 7),
					),
					msg(
						"m_gaming_2",
						"assistant",
						[
							text(
								"On it — feature grid, a comparison table against a standard chair, and a COD form with color choice. Building the first version.",
							),
							gen("v_gaming_1", 1, "Initial generation"),
						],
						iso(16),
					),
				],
				deployment: { ...DRAFT_DEPLOYMENT },
				pixels: { ...NO_PIXELS },
			};

		default:
			return emptyState();
	}
}

// --- store -----------------------------------------------------------------

let cache: Record<string, WorkspaceState> | null = null;

function loadAll(): Record<string, WorkspaceState> {
	if (cache) return cache;
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (raw) {
			cache = JSON.parse(raw) as Record<string, WorkspaceState>;
			return cache;
		}
	} catch {
		// unreadable storage — fall through to a fresh store
	}
	cache = {};
	return cache;
}

function persist(): void {
	if (!cache) return;
	try {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
	} catch {
		// storage unavailable — in-memory cache still serves the session
	}
}

function getState(projectId: string): WorkspaceState {
	const all = loadAll();
	if (!all[projectId]) {
		all[projectId] = seedFor(projectId);
		persist();
	}
	return all[projectId];
}

/** Deep-copied snapshot — safe to hand to the query cache. */
export function getWorkspaceSnapshot(projectId: string): WorkspaceState {
	return structuredClone(getState(projectId));
}

export function appendMockMessage(
	projectId: string,
	input: { role: ChatMessage["role"]; parts: MessagePart[] },
): ChatMessage {
	const message: ChatMessage = {
		id: `m_${crypto.randomUUID().slice(0, 8)}`,
		role: input.role,
		parts: input.parts,
		createdAt: new Date().toISOString(),
	};
	getState(projectId).messages.push(message);
	persist();
	return message;
}

export function createMockVersion(
	projectId: string,
	input: { label: string; lang: PageVersion["lang"]; pageKey: string },
): PageVersion {
	const state = getState(projectId);
	const nextNumber =
		state.versions.reduce((max, v) => Math.max(max, v.number), 0) + 1;
	const created: PageVersion = {
		id: `v_${crypto.randomUUID().slice(0, 8)}`,
		number: nextNumber,
		label: input.label,
		lang: input.lang,
		pageKey: input.pageKey,
		createdAt: new Date().toISOString(),
	};
	state.versions.push(created);
	persist();
	return created;
}

export function patchMockDeployment(
	projectId: string,
	patch: Partial<Deployment>,
): Deployment {
	const state = getState(projectId);
	state.deployment = { ...state.deployment, ...patch };
	persist();
	return { ...state.deployment };
}

export function patchMockPixels(
	projectId: string,
	patch: Partial<PixelSettings>,
): PixelSettings {
	const state = getState(projectId);
	state.pixels = { ...state.pixels, ...patch };
	persist();
	return { ...state.pixels };
}

export function deleteMockWorkspace(projectId: string): void {
	const all = loadAll();
	delete all[projectId];
	persist();
}
