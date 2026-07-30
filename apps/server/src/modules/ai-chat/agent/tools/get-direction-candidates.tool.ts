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
		"Sample a fresh menu of DESIGN WORLDS for this business (websites pick " +
		"exactly one — pass its id as worldId to generate_page). Call it BEFORE " +
		"composing any brief — the returned worlds are your ONLY world menu. " +
		"Pass industryHints (2-4 lowercase English keywords) so part of the " +
		"menu is guaranteed to fit the business.",
	inputSchema: getDirectionCandidatesInputSchema,
	outputSchema: getDirectionCandidatesOutputSchema,
	// No cooldownIds yet: the served_directions cooldown table is a later
	// iteration; the sampler already accepts it.
	execute: async ({ business, industryHints }) => ({
		candidates: formatWorldCandidates({ business, industryHints }),
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
