/**
 * Cost-cap contract for V2 app projects (`/api/v2/projects/:id/cost-caps`).
 * The route reads and writes the `project_cost_caps` row of the project.
 * Owners use it to bound builder-turn spend; a null field means the plan
 * default applies.
 */
import { z } from "zod";

/**
 * The caps of one project, in centi-credits (1 credit = 100 cc).
 * A null field means the plan default applies.
 */
export const projectCostCapsSchema = z.object({
	// Monthly spend cap in centi-credits; null uses the plan default.
	monthlyCapCredits: z.int().positive().nullable(),
	// Single-turn spend cap in centi-credits; null uses the plan default.
	// The 250_000 cc max is the `agent_session` reserve ceiling.
	perTurnCapCredits: z.int().positive().max(250_000).nullable(),
});

/** The `project_cost_caps` row the GET route answers. */
export type ProjectCostCaps = z.infer<typeof projectCostCapsSchema>;

/** Body of `PUT /api/v2/projects/:id/cost-caps`; same shape as the stored row. */
export const updateProjectCostCapsRequestSchema = projectCostCapsSchema;

/** The body the PUT route stores in `project_cost_caps`. */
export type UpdateProjectCostCapsRequest = z.infer<
	typeof updateProjectCostCapsRequestSchema
>;
