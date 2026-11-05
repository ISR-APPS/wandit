/**
 * TanStack Query keys and queries of project sharing. queryFn delegates to
 * sharing.services.ts. The keys have no workspace segment: these routes use
 * the project role, not the workspace header.
 * Read by the Share dialog, the dashboard, the settings panel, and the invite page.
 */
import { queryOptions, skipToken } from "@tanstack/react-query";

import {
	getProjectSharing,
	getReceivedProjectInvitation,
	listSharedProjects,
	listWorkspaceMembers,
} from "./sharing.services";

/** Query keys of project sharing. Every key starts with `project-sharing`. */
export const sharingKeys = {
	all: ["project-sharing"] as const,
	sharing: (projectId: string) =>
		[...sharingKeys.all, "sharing", projectId] as const,
	sharedProjects: () => [...sharingKeys.all, "shared-projects"] as const,
	receivedInvitation: (invitationId: string) =>
		[...sharingKeys.all, "received-invitation", invitationId] as const,
	workspaceMembers: (organizationId: string) =>
		[...sharingKeys.all, "workspace-members", organizationId] as const,
};

/** The Share dialog state of one project. The avatar stack reads it too. */
export const projectSharingQuery = (projectId: string) =>
	queryOptions({
		queryKey: sharingKeys.sharing(projectId),
		queryFn: () => getProjectSharing(projectId),
	});

/** "Shared with me" of the dashboard. It waits while `enabled` is false (organizations off). */
export const sharedProjectsQuery = (enabled: boolean) =>
	queryOptions({
		queryKey: sharingKeys.sharedProjects(),
		queryFn: enabled ? listSharedProjects : skipToken,
	});

/** One invitation of the signed-in user. A 404 is final, so the page reads it without a retry. */
export const receivedProjectInvitationQuery = (invitationId: string) =>
	queryOptions({
		queryKey: sharingKeys.receivedInvitation(invitationId),
		queryFn: () => getReceivedProjectInvitation(invitationId),
		retry: false,
	});

/** The members of the project's workspace, for Transfer ownership. */
export const workspaceMembersQuery = (organizationId: string) =>
	queryOptions({
		queryKey: sharingKeys.workspaceMembers(organizationId),
		queryFn: () => listWorkspaceMembers(organizationId),
	});
