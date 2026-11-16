/**
 * Device family of a V2 app, shared by the V1 and V2 project contracts.
 * V1 `projectSchema` reads it for the dashboard badge; `v2/projects.ts`
 * reads it for the create body and re-exports the names.
 */
import { z } from "zod";

/** Device family a V2 app targets. Matches `project_target_platform`. */
export const targetPlatforms = ["web", "mobile", "desktop"] as const;

/** The V2 create body defaults it to "web"; the V1 `projectSchema` makes it nullable. */
export const targetPlatformSchema = z.enum(targetPlatforms);

/** Also the key of `TEMPLATE_PROFILES` on the server: it selects the archive, the dev command, and the port. */
export type TargetPlatform = z.infer<typeof targetPlatformSchema>;

/**
 * Native shell of a desktop app. Matches the pg enum `desktop_engine`.
 * "electron" is the experimental engine of the app type "Desktop app 2".
 */
export const desktopEngines = ["tauri", "electron"] as const;

/** The V2 create body accepts it only with the target platform "desktop". */
export const desktopEngineSchema = z.enum(desktopEngines);

/** The desktop build task reads it to select the shell folder and the CI workflow. */
export type DesktopEngine = z.infer<typeof desktopEngineSchema>;
