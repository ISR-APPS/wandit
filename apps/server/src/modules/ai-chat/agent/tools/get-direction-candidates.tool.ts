import {
	type GetDirectionCandidatesInput,
	type GetDirectionCandidatesOutput,
	getDirectionCandidatesInputSchema,
	getDirectionCandidatesOutputSchema,
} from "@wandit/contracts";
import { type Tool, tool } from "ai";

import { formatCandidates, sampleCandidates } from "../directions/directions";

// Server-side execute: the model calls it mid-loop and gets
// the candidate menu back as the result. The sampling randomness lives HERE,
// never in the model — that is the whole anti-convergence mechanism (two
// candle shops must get two different menus, so two different pages).
export const getDirectionCandidatesTool: Tool<
	GetDirectionCandidatesInput,
	GetDirectionCandidatesOutput
> = tool({
	description:
		"Sample a fresh menu of design directions for this business: palettes, " +
		"font pairings, page skeletons, signature interactions and motion " +
		"vocabularies. Call it BEFORE composing any brief — the returned " +
		"candidates are your ONLY menu for those five choices.",
	inputSchema: getDirectionCandidatesInputSchema,
	outputSchema: getDirectionCandidatesOutputSchema,
	// No cooldownIds yet: the served_directions cooldown table is a later
	// iteration; the sampler already accepts it.
	execute: async ({ business }) => ({
		candidates: formatCandidates(sampleCandidates({ business })),
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
