// The `/project-invite` page (project-sharing feature) invalidates `projectInvitationsKeys.received()`.
export { projectInvitationsKeys } from "./api/project-invitations.queries";
export {
	hydrateWorkspaceScope,
	useCollaborationGates,
	useWorkspace,
} from "./lib/workspace-provider";
export { workspaceScopeHeaders } from "./lib/workspace-scope";
