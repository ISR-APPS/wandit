import {
	type GetDirectionCandidatesInput,
	type GetDirectionCandidatesOutput,
	getDirectionCandidatesInputSchema,
	getDirectionCandidatesOutputSchema,
} from "@wandit/contracts";
import { type Tool, tool } from "ai";

import { formatWorldCandidates } from "../worlds";

// Server-side execute: the model calls it mid-loop and gets
// the candidate menu back as the result. The sampling randomness lives HERE,
// never in the model — that is the whole anti-convergence mechanism (two
// candle shops must get two different menus, so two different pages).
//
// EXPERIMENT (2026-07-27): worlds-only menu. The direction axes (palettes,
// font pairings, skeletons, layout moves, interactions, motions, finishes)
// stay unplugged — the brain invents those itself; only the world menu is
// sampled. Since the landing-batch merge, websites are back on the menu in
// DEPARTURE-POINT mode: the brain picks one world as inspiration and writes
// its own divergences into the brief.
export const getDirectionCandidatesTool: Tool<
	GetDirectionCandidatesInput,
	GetDirectionCandidatesOutput
> = tool({
	description:
		"Sample a fresh menu of DESIGN WORLDS for this business. ALWAYS pass " +
		'pageKind explicitly: "cod" for a COD funnel (the fusion menu) or ' +
		'"website" for a website/landing build (the departure-point menu; it ' +
		"also carries a product-dossier section for single-product " +
		"presentation pages). Call it BEFORE any taste question and BEFORE " +
		"composing the brief — the returned worlds are your ONLY menu. COD: " +
		"pick one base plus 2-3 donors and pass their ids to " +
		"generate_page.worldIds base-first with pageKind cod. Website: pick " +
		"EXACTLY ONE world as the departure point (honor the user's taste " +
		"pick when they made one) and pass its id alone in " +
		"generate_page.worldIds with pageKind website. Pass industryHints " +
		"(2-4 lowercase English keywords) so part of the menu is guaranteed " +
		"to fit the business. For COD use the taxonomy: beauty & cosmetics, " +
		"health & wellness, home & kitchen, electronics & gadgets, fashion & " +
		"apparel, jewelry & watches, kids & baby, car accessories, pets, " +
		"fitness equipment (single keywords like beauty also match). For " +
		"websites, prefer the business's niche word (dentist, barber, " +
		"pizzeria, architect, lawyer, hotel...) plus its category from the " +
		"site taxonomy: medical, beauty, fitness, restaurant, real estate, " +
		"construction, automotive, services, education, creative agency, " +
		"ecommerce, travel, events, tech-saas. Free keywords also match.",
	inputSchema: getDirectionCandidatesInputSchema,
	outputSchema: getDirectionCandidatesOutputSchema,
	// No cooldownIds yet: the served_directions cooldown table is a later
	// iteration; the sampler already accepts it.
	execute: async ({ business, industryHints, pageKind }) =>
		// Returns the menu text plus the sampled worlds' card faces — the tray
		// renders taste cards from those when ask_user options carry worldId.
		formatWorldCandidates({
			business,
			industryHints,
			// Backstop only — the description demands an explicit pageKind. A
			// missing one falls to the COD menu, never the legacy worldId menu.
			pageKind: pageKind ?? "cod",
		}),
});

// Execute-less twin used ONLY for validateUIMessages in the controller —
// validating old messages must never re-roll a sample.
export const getDirectionCandidatesToolSchemaOnly: Tool<
	GetDirectionCandidatesInput,
	GetDirectionCandidatesOutput
> = tool({
	inputSchema: getDirectionCandidatesInputSchema,
	outputSchema: getDirectionCandidatesOutputSchema,
});
