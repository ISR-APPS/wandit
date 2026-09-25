/**
 * Device family of a V2 app, shared by the V1 and V2 project contracts.
 * V1 `projectSchema` reads it for the dashboard badge; `v2/projects.ts`
 * reads it for the create body and re-exports the names.
 */
import { z } from "zod";

/** Device family a V2 app targets. Matches `project_target_platform`. */
export const targetPlatforms = ["web", "mobile"] as const;

/** The V2 create body defaults it to "web"; the V1 `projectSchema` makes it nullable. */
export const targetPlatformSchema = z.enum(targetPlatforms);

/** Also the key of `TEMPLATE_PROFILES` on the server: it selects the archive, the dev command, and the port. */
export type TargetPlatform = z.infer<typeof targetPlatformSchema>;
