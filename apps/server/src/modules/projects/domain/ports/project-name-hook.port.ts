/**
 * Port: a hook that `ProjectsService` calls after the name of a V2 app
 * changes. The projects module has no event emitter, so other modules plug in
 * here. The V2 app builder gives a Trigger task starter that syncs the From
 * name of the sign-up code email; a V1 deploy binds null.
 */

/** Nest token carrying the hook; null when V2 is off at boot. */
export const PROJECT_NAME_HOOK = Symbol.for("projects.project-name-hook");

/** Called after a manual rename and after the title job writes a name. */
export interface ProjectNameHook {
	/**
	 * Takes the new name of the project into account. It can throw. The
	 * caller already stored the name, so the caller logs the error and goes on.
	 */
	onProjectNameChanged(projectId: string): Promise<void>;
}
