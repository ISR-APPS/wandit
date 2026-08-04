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
// are unplugged — the brain invents those itself; only the world menu is
// sampled. Restore the formatCandidates(sampleCandidates(...)) line (and the
// full description) via git to bring the axes back.
export const getDirectionCandidatesTool: Tool<
	GetDirectionCandidatesInput,
	GetDirectionCandidatesOutput
> = tool({
	description:
		"For COD funnels only, sample a fresh menu of DESIGN WORLDS for this " +
		"business. Omit pageKind; this tool serves the COD funnel menu. Call it " +
		"BEFORE composing the brief — the returned worlds are " +
		"your ONLY menu. Pick one base plus 2-3 donors, then pass their ids to " +
		"generate_page.worldIds base-first with pageKind cod. " +
		"Pass industryHints (2-4 lowercase English keywords) so part of the " +
		"menu is guaranteed to fit the business. Use the COD taxonomy: " +
		"beauty & cosmetics, health & wellness, home & kitchen, electronics & " +
		"gadgets, fashion & apparel, jewelry & watches, kids & baby, car " +
		"accessories, pets, fitness equipment; single keywords like beauty " +
		"also match.",
	inputSchema: getDirectionCandidatesInputSchema,
	outputSchema: getDirectionCandidatesOutputSchema,
	// No cooldownIds yet: the served_directions cooldown table is a later
	// iteration; the sampler already accepts it.
	execute: async ({ business, industryHints, pageKind }) => ({
		candidates: formatWorldCandidates({
			business,
			industryHints,
			// The live sampler is COD-only; websites keep the 2026-07-27 worlds-off
			// experiment. Omitted pageKind must never reach the legacy worldId menu.
			pageKind: pageKind ?? "cod",
		}),
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
