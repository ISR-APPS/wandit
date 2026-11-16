import { describe, expect, it } from "vitest";

import type { StarterTemplate, StarterTemplateCategory } from "../api/dto";
import { filterStarterTemplates } from "./helpers";
import type { TemplatesSearch } from "./schemas";

const CLINIC: StarterTemplate = {
	id: "clinic",
	kind: "website",
	name: "Nova Clinic",
	category: "health",
	tagline: {
		en: "A calm site for a dental practice",
		fr: "Un site apaisé pour un cabinet dentaire",
		ar: "موقع هادئ لعيادة أسنان",
	},
	description: {
		en: "Services, team, and opening hours.",
		fr: "Soins, équipe et horaires.",
		ar: "الخدمات والفريق وساعات العمل.",
	},
	mode: "light",
	shots: 0,
};

const LEDGER: StarterTemplate = {
	id: "ledger",
	kind: "app",
	name: "Ledgerly",
	category: "finance",
	tagline: {
		en: "Invoices and cash flow at a glance",
		fr: "Factures et trésorerie en un coup d’œil",
		ar: "الفواتير والتدفق النقدي في لمحة",
	},
	description: {
		en: "A dashboard for a small business.",
		fr: "Un tableau de bord pour une petite entreprise.",
		ar: "لوحة تحكم لشركة صغيرة.",
	},
	mode: "dark",
	shots: 2,
};

const CATEGORY_LABELS: Partial<Record<StarterTemplateCategory, string>> = {
	health: "Santé",
	finance: "Finance",
};

describe("filterStarterTemplates", () => {
	it.each<[string, TemplatesSearch, string[]]>([
		["no filter keeps the catalog order", {}, ["clinic", "ledger"]],
		["a kind", { kind: "app" }, ["ledger"]],
		["a category", { category: "health" }, ["clinic"]],
		[
			"a kind and a category with no member",
			{ kind: "app", category: "health" },
			[],
		],
		["the name in another case", { q: "NOVA" }, ["clinic"]],
		["a tagline word without its accent", { q: "tresorerie" }, ["ledger"]],
		["a description word", { q: "horaires" }, ["clinic"]],
		["the category label without its accent", { q: "sante" }, ["clinic"]],
		[
			"two words in two fields, in any order",
			{ q: "dentaire  nova" },
			["clinic"],
		],
		["two words when only one matches", { q: "nova factures" }, []],
		["text of another UI language", { q: "invoices" }, []],
		["spaces only", { q: "   " }, ["clinic", "ledger"]],
		["a search text and a kind", { q: "un", kind: "website" }, ["clinic"]],
	])("%s", (_name, search, expectedIds) => {
		const results = filterStarterTemplates(
			[CLINIC, LEDGER],
			search,
			"fr",
			(category) => CATEGORY_LABELS[category] ?? "",
		);
		expect(results.map((starterTemplate) => starterTemplate.id)).toEqual(
			expectedIds,
		);
	});
});
