/**
 * Port: a hook the domains module calls after a custom domain of a project
 * goes live or goes away (WANDIT-190). The domains module has no event
 * emitter, so other modules plug in here. The V2 app builder gives a Trigger
 * task starter that syncs the backend login URLs; a V1 deploy binds null.
 */

/** Nest token carrying the hook; null when V2 is off at boot. */
export const PROJECT_DOMAIN_HOOK = Symbol.for("domains.project-domain-hook");

/** Called after `activateDomain`, the activation step, `setPrimary`, and `detach` of a V2 app domain. */
export interface ProjectDomainHook {
	/**
	 * Takes the new set of active domains of the project into account. It
	 * can throw. The caller already changed the domain, so the caller logs
	 * the error and goes on.
	 */
	onProjectDomainsChanged(projectId: string): Promise<void>;
}
