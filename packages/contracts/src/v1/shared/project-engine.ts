/**
 * Which builder produced a project, shared by the V1 and V2 contracts.
 * V1 `projectSchema` and the V2 `appProjectSchema` both read this file;
 * `v2/projects.ts` re-exports the names so earlier V2 imports keep working.
 */
// Zod checks values at runtime.
import { z } from "zod";

/**
 * Which builder produced the project. Matches the `project_engine` database
 * enum (WANDIT-163). A project never changes engine after creation (D11).
 */
export const projectEngines = ["v1_page", "v2_app"] as const;

/** Runtime validator for a project engine. */
export const projectEngineSchema = z.enum(projectEngines);

/** TypeScript project engine type. */
export type ProjectEngine = z.infer<typeof projectEngineSchema>;
