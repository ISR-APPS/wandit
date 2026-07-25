import {
	type GetDirectionCandidatesInput,
	type GetDirectionCandidatesOutput,
	getDirectionCandidatesInputSchema,
	getDirectionCandidatesOutputSchema,
} from "@wandit/contracts";
import { type Tool, tool } from "ai";

import { formatCandidates, sampleCandidates } from "../directions/directions";
import { formatWorldCandidates } from "../worlds";

// Server-side execute: the model calls it mid-loop and gets
// the candidate menu back as the result. The sampling randomness lives HERE,
// never in the model — that is the whole anti-convergence mechanism (two
// candle shops must get two different menus, so two different pages).
export const getDirectionCandidatesTool: Tool<
	GetDirectionCandidatesInput,
	GetDirectionCandidatesOutput
> = tool({
	description:
		"Sample a fresh menu of design directions for this business: DESIGN " +
		"WORLDS (websites pick exactly one — pass its id as worldId to " +
		"generate_page) plus palettes, font pairings, page skeletons, layout " +
		"moves, signature interactions, motion vocabularies and finishes. Call " +
		"it BEFORE composing any brief — the returned candidates are your ONLY " +
		"menu for those choices. Pass industryHints (2-4 lowercase English " +
		"keywords) so part of the menu is guaranteed to fit the business.",
	inputSchema: getDirectionCandidatesInputSchema,
	outputSchema: getDirectionCandidatesOutputSchema,
	// No cooldownIds yet: the served_directions cooldown table is a later
	// iteration; the sampler already accepts it.
	// Worlds lead the menu: for websites the world decides composition and
	// motion; the sampled axes below it supply the hexes/fonts/interaction
	// that instantiate it (and the full menu for world-less COD builds).
	execute: async ({ business, industryHints }) => ({
		candidates:
			`${formatWorldCandidates({ business, industryHints })}\n\n` +
			formatCandidates(sampleCandidates({ business, industryHints })),
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
