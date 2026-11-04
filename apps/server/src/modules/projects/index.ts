// Project access for other modules: the `:projectId` route gate, the role order, and the project scopes.
export { ProjectAccessService } from "./application/services/project-access.service";
export { ProjectsService } from "./application/services/projects.service";
export {
	isProjectOwner,
	type ProjectAccessFacts,
	projectRoleAtLeast,
	type ResolvedProjectAccess,
	// The MCP spec runs the real role rule on its fake rows.
	resolveProjectAccess,
} from "./domain/project-access";
export {
	projectScopeFrom,
	projectScopeFromAccess,
	systemProjectScope,
} from "./domain/project-scope";
export {
	CurrentProjectAccess,
	type MaybeProjectAccessRequest,
	PROJECT_ROLE_KEY,
	RequireProjectRole,
} from "./presentation/http/decorators/project-access.decorators";
export { ProjectAccessGuard } from "./presentation/http/guards/project-access.guard";
